// Demo data. Staff accounts use the project team's names. Every resident, party, sitio, contact and incident
// below is invented for demonstration only and does not describe real residents, households or cases.
import mysql from '../apps/api/node_modules/mysql2/promise.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { databaseConfig } from '../apps/api/src/db.js';
import { hashPassword } from '../apps/api/src/passwords.js';
import { validateIntake } from '../apps/api/src/validation.js';
import { validatePublicReport } from '../apps/api/src/routes.js';
import { changeBlotterStatus, createBlotter } from '../apps/api/src/services/blotters.js';
import {
  approveResidentReport, createPublicReport, rejectResidentReport, validateApprovalAgainstOriginal
} from '../apps/api/src/services/resident-reports.js';

const here = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(here, '../apps/api/.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const DAY = 86400000;
const STAFF_ACCOUNTS = [
  ['kacey.burce', 'Kacey Burce', 'cebu-city-lahug'],
  ['eunice.melencion', 'Eunice Melencion', 'cebu-city-lahug'],
  ['steven.tampos', 'John Steven Tampos', 'mandaue-city-subangdaku'],
  ['pio.simbajon', 'Pio Simbajon', 'mandaue-city-subangdaku']
];
const CONTACT = (n) => `0900 000 0${String(n).padStart(3, '0')}`;

// Manila wall-clock time `daysAgo` days back, as an explicit +08:00 timestamp. daysAgo >= 1 keeps it in the past.
function manilaAt(daysAgo, hour, minute) {
  const day = new Date(Date.now() + 8 * 3600000 - daysAgo * DAY).toISOString().slice(0, 10);
  return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`;
}

// Walk-in blotters. `steps` are status changes after creation; a reopen to pending_lupon carries a reason.
const LAHUG_WALK_INS = [
  { by: 'demo_a', ago: 4, hour: 21, minute: 20, status: 'draft', type: 'curfew_violation', sitio: 'Purok Sampaguita', landmark: 'near the chapel',
    complainant: 'Liza Mae Gonzaga', respondent: null,
    narrative: 'Reporter saw three minors walking along the chapel road past 10 PM on a school night. They were told to go home and left. The reporter asked that the sighting be recorded.', steps: [] },
  { by: 'kacey.burce', ago: 41, hour: 23, minute: 40, status: 'pending_lupon', type: 'noise_disturbance', sitio: 'Purok 4', landmark: 'in front of a sari-sari store',
    complainant: 'Rodel Cabahug', complainantContact: CONTACT(101), respondent: 'Edgar Sumbillo', respondentContact: CONTACT(142),
    narrative: 'Videoke ran past midnight during the fiesta novena, and the complainant says repeated requests to lower the volume were ignored. The respondent says it was a birthday party and the speakers were turned down after the first complaint.', steps: [] },
  { by: 'demo_a_staff', ago: 33, hour: 9, minute: 15, status: 'pending_lupon', type: 'property_dispute', sitio: 'Purok Rosal', landmark: 'beside the basketball court',
    complainant: 'Maricel Abangan', respondent: 'Ronaldo Tumulak',
    narrative: 'A new bamboo fence was built about 40 centimeters past the concrete marker the complainant says separates the two lots. The respondent says the marker was never surveyed. Both sides agreed to a joint re-measurement before any fence is moved.',
    steps: [['settled_at_desk', 'Both parties agreed to a joint re-measurement; fence to be adjusted after the survey.']] },
  { by: 'eunice.melencion', ago: 55, hour: 14, minute: 5, status: 'pending_lupon', type: 'financial_dispute', sitio: 'Purok Malipayon', landmark: 'near the health center',
    complainant: 'Jessa Mae Tabada', complainantContact: CONTACT(158), respondent: 'Efren Cuizon', respondentContact: CONTACT(177),
    narrative: 'The complainant lent PHP 8,000 in March on a promise to repay within three months. Payments stopped after June. The respondent acknowledges the loan but disputes the remaining balance and asks for an itemized statement.', steps: [] },
  { by: 'demo_a', ago: 18, hour: 17, minute: 30, status: 'settled_at_desk', type: 'physical_altercation', sitio: 'Purok 2', landmark: 'in front of the barangay waiting shed',
    complainant: 'Rowena Ocampo', respondent: 'Kevin Tamayo',
    narrative: 'After a barangay basketball game, two players argued and one shoved the other. The complainant has a bruise on her left arm from stepping in. No medical certificate was presented. Both players agreed to keep apart and to settle it at the desk.', steps: [] },
  { by: 'kacey.burce', ago: 12, hour: 18, minute: 45, status: 'pending_lupon', type: 'others', sitio: 'Purok Ilang-ilang', landmark: 'near the chapel',
    complainant: 'Dennis Lumapas', complainantContact: CONTACT(204), respondent: 'Restituto Gallardo',
    narrative: 'A neighbor\'s dog bit a seven-year-old on the calf as the child walked past the gate. The wound was cleaned at the health center. The owner says the dog was leashed, but he did not attend the summons.',
    steps: [['referred_to_pnp', 'Owner did not attend the mediation summons; referred for further action.']] },
  { by: 'demo_a_staff', ago: 22, hour: 10, minute: 20, status: 'pending_lupon', type: 'others', sitio: 'Purok Sampaguita', landmark: 'at the gate of a house',
    complainant: 'Benjie Lagunay', respondent: null,
    narrative: 'A blue bicycle was taken from the gate of a house in Purok Sampaguita during the night. The complainant suspects a former helper but has no proof. A lupon hearing was set, but the suspect did not appear.',
    steps: [['unresolved', 'Suspect did not appear at the scheduled hearing; no evidence presented.']] },
  { by: 'eunice.melencion', ago: 15, hour: 20, minute: 0, status: 'pending_lupon', type: 'noise_disturbance', sitio: 'Purok 7', landmark: 'beside the covered court',
    complainant: 'Nenita Caballero', respondent: null,
    narrative: 'Karaoke sessions at a house near the covered court run until after 11 PM on weekends. The household agreed at the desk to stop earlier, but the sessions resumed the following weekend.',
    steps: [['settled_at_desk', 'Household agreed to a 10 PM limit for videoke at the desk.'], ['pending_lupon', 'Videoke resumed the following weekend; complainant asked for a formal hearing.']] },
  { by: 'demo_a_staff', ago: 6, hour: 13, minute: 10, status: 'pending_lupon', type: 'property_dispute', sitio: 'Purok Sampaguita', landmark: 'behind the health center',
    complainant: 'Dolores Vitug', complainantContact: CONTACT(233), respondent: 'Armando Labiste',
    narrative: 'A mango tree on the respondent\'s lot has branches hanging over the complainant\'s roof that drop debris during storms. The respondent said he would trim it but has not done so yet. The complainant asks for a written schedule.', steps: [] },
  { by: 'kacey.burce', ago: 2, hour: 23, minute: 5, status: 'draft', type: 'physical_altercation', sitio: 'Purok 4', landmark: 'near the sari-sari store at the corner',
    complainant: 'Ruel Sumalinog', respondent: null,
    narrative: 'An argument during a late-night pool game outside a sari-sari store turned into a brief scuffle. No injuries were reported. The complainant asked that the incident be logged but does not want a hearing.', steps: [] }
];

const SUBANGDAKU_WALK_INS = [
  { by: 'demo_b', ago: 5, hour: 22, minute: 10, status: 'draft', type: 'curfew_violation', sitio: 'Purok Narra', landmark: 'near the elementary school gate',
    complainant: 'Teresita Caindoy', respondent: null,
    narrative: 'Three teenagers were seen at the basketball court after 10:30 PM and were asked to go home. They left without argument. The reporter asked for the visit to be recorded.', steps: [] },
  { by: 'steven.tampos', ago: 35, hour: 19, minute: 50, status: 'pending_lupon', type: 'noise_disturbance', sitio: 'Purok 3', landmark: 'beside the waiting shed',
    complainant: 'Ariel Villamor', complainantContact: CONTACT(301), respondent: 'Glenn Tudtud', respondentContact: CONTACT(256),
    narrative: 'A family celebration with a karaoke machine continued until after midnight, and a neighbor on night shift could not sleep. The respondent says it was a one-time event and apologized at the gate the next morning.', steps: [] },
  { by: 'demo_b', ago: 29, hour: 11, minute: 0, status: 'pending_lupon', type: 'financial_dispute', sitio: 'Purok Dahlia', landmark: 'near the covered court',
    complainant: 'Lolita Sabellano', respondent: 'Mario Rañola',
    narrative: 'The complainant sold a secondhand motorbike on installment, and the buyer missed three payments. The buyer says work has been slow and asked for a revised schedule. Both sides agreed to the new schedule at the desk.',
    steps: [['settled_at_desk', 'Revised installment schedule agreed at the desk.']] },
  { by: 'steven.tampos', ago: 52, hour: 8, minute: 40, status: 'pending_lupon', type: 'property_dispute', sitio: 'Sitio Pag-asa', landmark: 'near the chapel',
    complainant: 'Ferdinand Pagaduan', respondent: 'Cora Lynn Dinglasan',
    narrative: 'A water hose runs across both lots and was reconnected without permission. The respondent says the previous owner installed it and that she was never told. The complainant wants the line moved before the rainy season.', steps: [] },
  { by: 'demo_b', ago: 20, hour: 16, minute: 15, status: 'settled_at_desk', type: 'physical_altercation', sitio: 'Purok 5', landmark: 'in front of a sari-sari store',
    complainant: 'Jun-Jun Espina', respondent: 'Ronnie Bongcawil',
    narrative: 'Two neighbors argued over a parked tricycle and exchanged shoves. Neither was hurt. They agreed to keep the tricycle on the side road and to keep apart while the matter is settled.', steps: [] },
  { by: 'pio.simbajon', ago: 14, hour: 9, minute: 0, status: 'pending_lupon', type: 'property_dispute', sitio: 'Purok 3', landmark: 'beside the waiting shed',
    complainant: 'Corazon Abella', complainantContact: CONTACT(312), respondent: 'Wilfredo Dagohoy',
    narrative: 'A tenant has stayed two months past the end of the lease and stopped answering messages. The landlord says two written summons went unanswered.',
    steps: [['referred_to_pnp', 'Tenant ignored two summons; referred for further action.']] },
  { by: 'demo_b', ago: 26, hour: 21, minute: 45, status: 'pending_lupon', type: 'others', sitio: 'Purok 3', landmark: 'near the chapel',
    complainant: 'Efren Calimag', respondent: null,
    narrative: 'A red bicycle was taken from a parked spot near the chapel during the fiesta night. No suspect has been identified, and the complainant asks that the case stay on record.',
    steps: [['unresolved', 'No suspect identified after the initial inquiry.']] },
  { by: 'steven.tampos', ago: 10, hour: 20, minute: 20, status: 'pending_lupon', type: 'noise_disturbance', sitio: 'Purok Dahlia', landmark: 'beside the covered court',
    complainant: 'Estela Quimpo', respondent: null,
    narrative: 'A drum and bugle group practicing for the fiesta parade ran until 11 PM on three nights, and neighbors asked them to finish earlier. The group agreed at the desk to end by 9 PM, but practice ran late again on the next two nights.',
    steps: [['settled_at_desk', 'Group agreed to end practice by 9 PM.'], ['pending_lupon', 'Practice ran past 10 PM on two more nights; complainant requested a hearing.']] },
  { by: 'demo_b', ago: 7, hour: 17, minute: 40, status: 'pending_lupon', type: 'physical_altercation', sitio: 'Purok 5', landmark: 'beside the basketball court',
    complainant: 'Rommel Tejada', respondent: 'Edwin Bacalso',
    narrative: 'A scuffle broke out between a player and a spectator after a close basketball game. The spectator says he was pushed into a fence, and the player says the spectator started it. Minor scratches were treated at home.', steps: [] },
  { by: 'pio.simbajon', ago: 1, hour: 8, minute: 5, status: 'draft', type: 'property_dispute', sitio: 'Purok Dahlia', landmark: 'behind the health center',
    complainant: 'Lorna Gacutan', complainantContact: CONTACT(330), respondent: 'Noel Bantilan', respondentContact: CONTACT(311),
    narrative: 'A neighbor\'s gutter drains onto the complainant\'s yard during heavy rain, leaving the yard flooded for days. The complainant asks for an inspection before the next rainy season.', steps: [] }
];

// Resident submissions. Approved ones set `by` and `approveAs` (the intake status); rejected ones set `by` and `reason`.
const LAHUG_REPORTS = [
  { ago: 3, hour: 14, minute: 10, type: 'property_dispute', sitio: 'Purok Sampaguita', landmark: 'near the chapel', reporter: 'Analyn Ceniza', reporterContact: CONTACT(415), respondent: null,
    narrative: 'A neighbor\'s drainage pipe was moved during repairs and now empties onto the reporter\'s side of the lot line whenever it rains. The reporter has asked twice for it to be fixed.', outcome: 'pending' },
  { ago: 6, hour: 19, minute: 30, type: 'noise_disturbance', sitio: 'Purok 4', landmark: 'beside the basketball court', reporter: 'Gemma Paglinawan', reporterContact: null, respondent: null,
    narrative: 'Loud videoke from a rented hall during the fiesta weekend continued until after midnight on Saturday. The reporter\'s infant could not sleep. The reporter is not sure which unit owns the speakers.', outcome: 'pending' },
  { by: 'kacey.burce', ago: 16, hour: 10, minute: 5, type: 'physical_altercation', sitio: 'Purok 2', landmark: 'in front of a sari-sari store', reporter: 'Vicente Gaviola', reporterContact: CONTACT(528), respondent: 'Jerome Sepe',
    narrative: 'A neighbor threw a plastic chair during an argument over a shared water hose. The chair struck the reporter on the shoulder. The reporter did not need treatment but wants the matter recorded.', outcome: 'approved', approveAs: 'pending_lupon' },
  { by: 'eunice.melencion', ago: 9, hour: 16, minute: 40, type: 'financial_dispute', sitio: 'Purok Malipayon', landmark: null, reporter: 'Erlinda Montebon', reporterContact: null, respondent: null,
    narrative: 'A cooperative member borrowed PHP 3,500 last month and has not returned it. The reporter says the member now avoids her at the market. She wants the amount recorded and a repayment schedule set.', outcome: 'approved', approveAs: 'settled_at_desk' },
  { by: 'eunice.melencion', ago: 11, hour: 21, minute: 0, type: 'noise_disturbance', sitio: 'Purok 4', landmark: 'in front of a sari-sari store', reporter: 'Teodora Abejo', reporterContact: null, respondent: null,
    narrative: 'Videoke at the house near the store kept going past midnight during the fiesta novena. The same household was already reported at the desk.', outcome: 'rejected', by: 'eunice.melencion', reason: 'Duplicate of a walk-in complaint already recorded' },
  { by: 'eunice.melencion', ago: 25, hour: 15, minute: 30, type: 'property_dispute', sitio: 'Purok 7', landmark: null, reporter: 'Samuel Rebutar', reporterContact: null, respondent: 'Pedro Dagatan',
    narrative: 'The reporter says a fence was built on a lot inside a neighboring subdivision. The reporter lives across the road and wants the barangay to intervene.', outcome: 'rejected', by: 'eunice.melencion', reason: 'Incident occurred outside the barangay\'s jurisdiction' }
];

const SUBANGDAKU_REPORTS = [
  { ago: 4, hour: 6, minute: 30, type: 'others', sitio: 'Purok 3', landmark: 'beside the waiting shed', reporter: 'Maria Fe Balili', reporterContact: null, respondent: null,
    narrative: 'A neighbor keeps several roosters in a small pen next to the reporter\'s kitchen. The roosters start crowing before 4 AM. The reporter asks the desk to talk to the owner.', outcome: 'pending' },
  { ago: 8, hour: 18, minute: 20, type: 'property_dispute', sitio: 'Purok Narra', landmark: null, reporter: 'Arlene Ybañez', reporterContact: CONTACT(633), respondent: 'Lito Macaraeg',
    narrative: 'The respondent parks his car across the shared driveway every evening, which blocks the reporter\'s gate. The reporter has asked him to move it twice. The respondent says the driveway is public.', outcome: 'pending' },
  { by: 'steven.tampos', ago: 12, hour: 21, minute: 15, type: 'others', sitio: 'Purok 5', landmark: 'near the elementary school gate', reporter: 'Dennis Paquibot', reporterContact: CONTACT(699), respondent: null,
    narrative: 'Someone threw a stone at the reporter\'s gate during the night. The stone cracked a gate post. The reporter did not see who did it.', outcome: 'approved', approveAs: 'pending_lupon' },
  { by: 'demo_b', ago: 19, hour: 22, minute: 40, type: 'curfew_violation', sitio: 'Sitio Pag-asa', landmark: 'beside the basketball court', reporter: 'Ruben Tumaneng', reporterContact: null, respondent: null,
    narrative: 'Minors were drinking beer near the basketball court after 11 PM and left the bottles on the road. They left when asked. The reporter wants the incident noted for the parents.', outcome: 'approved', approveAs: 'settled_at_desk' },
  { by: 'pio.simbajon', ago: 13, hour: 23, minute: 10, type: 'noise_disturbance', sitio: 'Purok 3', landmark: 'beside the waiting shed', reporter: 'Sheryl Quinto', reporterContact: null, respondent: null,
    narrative: 'Karaoke from the same family celebration continued past midnight. The celebration was already reported at the desk by a neighbor.', outcome: 'rejected', by: 'steven.tampos', reason: 'Duplicate of a walk-in complaint already recorded' },
  { by: 'demo_b', ago: 21, hour: 13, minute: 0, type: 'property_dispute', sitio: 'Purok Dahlia', landmark: null, reporter: 'Eduardo Tomas', reporterContact: null, respondent: 'Pablo Mirasol',
    narrative: 'A boundary wall was built on a lot located in a neighboring barangay, and the reporter lives across the street. The reporter asks the barangay to mediate.', outcome: 'rejected', by: 'demo_b', reason: 'Incident occurred outside the barangay\'s jurisdiction' }
];

const PLANS = [
  { slug: 'cebu-city-lahug', label: 'Lahug', creators: ['demo_a', 'demo_a_staff', 'kacey.burce', 'eunice.melencion'], marker: ['kacey.burce', 'eunice.melencion'], walkIns: LAHUG_WALK_INS, reports: LAHUG_REPORTS },
  { slug: 'mandaue-city-subangdaku', label: 'Subangdaku', creators: ['demo_b', 'steven.tampos', 'pio.simbajon'], marker: ['steven.tampos', 'pio.simbajon'], walkIns: SUBANGDAKU_WALK_INS, reports: SUBANGDAKU_REPORTS }
];

// Build and validate every record before any write, so a contract violation never leaves a partial demo set.
function buildPlan(plan) {
  const walkIns = plan.walkIns.map((item) => {
    if (!plan.creators.includes(item.by)) throw new Error(`${plan.label} walk-in "${item.complainant}" has creator ${item.by} outside the barangay.`);
    const checked = validateIntake({
      incident_type: item.type, incident_datetime: manilaAt(item.ago, item.hour, item.minute), sitio: item.sitio, landmark: item.landmark,
      complainant_name: item.complainant, complainant_contact: item.complainantContact ?? null, complainant_sitio: null,
      complainant_resident_status: 'resident', respondent_unknown: item.respondent === null,
      respondent_name: item.respondent, respondent_contact: item.respondentContact ?? null, respondent_sitio: null,
      respondent_resident_status: item.respondent === null ? 'unknown' : 'resident', narrative: item.narrative, status: item.status
    });
    if (!checked.ok) throw new Error(`${plan.label} walk-in "${item.complainant}" failed validation: ${JSON.stringify(checked.fields)}`);
    return { by: item.by, at: checked.value.incident_datetime, intake: checked.value, steps: item.steps };
  });
  const reports = plan.reports.map((item) => {
    const incidentIso = manilaAt(item.ago, item.hour, item.minute);
    const checked = validatePublicReport({
      reporter_name: item.reporter, reporter_contact: item.reporterContact, incident_type: item.type, incident_datetime: incidentIso,
      sitio: item.sitio, landmark: item.landmark, respondent_name: item.respondent, narrative: item.narrative, website: ''
    });
    if (!checked.ok) throw new Error(`${plan.label} report by "${item.reporter}" failed validation: ${JSON.stringify(checked.fields)}`);
    const values = checked.value;
    const result = { values, submittedAt: new Date(values.incident_datetime.getTime() + 6 * 3600000), outcome: item.outcome, by: item.by, reason: item.reason };
    if (item.outcome === 'approved') {
      const intake = validateIntake({
        incident_type: values.incident_type, incident_datetime: incidentIso, sitio: values.sitio, landmark: values.landmark,
        complainant_name: values.reporter_name, complainant_contact: values.reporter_contact, complainant_sitio: null,
        complainant_resident_status: 'unknown', respondent_unknown: values.respondent_name === null, respondent_name: values.respondent_name,
        respondent_contact: null, respondent_sitio: null, respondent_resident_status: 'unknown', narrative: values.narrative, status: item.approveAs
      }, { allowDraft: false });
      if (!intake.ok) throw new Error(`${plan.label} approval for "${item.reporter}" failed validation: ${JSON.stringify(intake.fields)}`);
      const correspondence = validateApprovalAgainstOriginal(values, intake.value);
      if (!correspondence.ok) throw new Error(`${plan.label} approval for "${item.reporter}" breaks the original: ${JSON.stringify(correspondence.fields)}`);
      result.intake = intake.value;
    }
    if (item.outcome === 'rejected' && !item.reason) throw new Error(`${plan.label} rejection for "${item.reporter}" needs a reason.`);
    return result;
  });
  return { ...plan, walkIns, reports };
}

const pool = mysql.createPool(databaseConfig());
try {
  const plans = PLANS.map(buildPlan);
  const [barangayRows] = await pool.execute(`SELECT id, city_id, code, slug FROM barangays WHERE slug IN (${PLANS.map(() => '?').join(', ')})`, PLANS.map((plan) => plan.slug));
  for (const plan of PLANS) {
    if (!barangayRows.some((row) => row.slug === plan.slug)) throw new Error(`Barangay ${plan.slug} is missing. Run npm run db:seed first.`);
  }
  const requiredUsers = ['demo_a', 'demo_b', 'demo_a_staff'];
  const [existingUsers] = await pool.execute(`SELECT username FROM users WHERE username IN (${requiredUsers.map(() => '?').join(', ')})`, requiredUsers);
  for (const username of requiredUsers) {
    if (!existingUsers.some((row) => row.username === username)) throw new Error(`Demo account ${username} is missing. Run npm run db:seed first.`);
  }

  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD || 'DemoOnly!2026');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [username, displayName, slug] of STAFF_ACCOUNTS) {
      const barangay = barangayRows.find((row) => row.slug === slug);
      await connection.execute(
        'INSERT INTO users (barangay_id, username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE barangay_id = VALUES(barangay_id), password_hash = VALUES(password_hash), display_name = VALUES(display_name), role = VALUES(role), is_active = 1',
        [barangay.id, username, passwordHash, displayName, 'staff']
      );
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }

  const names = [...new Set([...PLANS.flatMap((plan) => plan.creators), ...STAFF_ACCOUNTS.map(([username]) => username)])];
  const [userRows] = await pool.execute(`SELECT id, username FROM users WHERE username IN (${names.map(() => '?').join(', ')})`, names);
  const userIds = new Map(userRows.map((row) => [row.username, Number(row.id)]));

  const summaries = [];
  for (const plan of plans) {
    const barangay = barangayRows.find((row) => row.slug === plan.slug);
    const tenant = { barangay_id: Number(barangay.id), barangay_code: barangay.code, city_id: Number(barangay.city_id) };
    const [[marker]] = await pool.execute(
      `SELECT COUNT(*) AS n FROM blotters b JOIN users u ON u.id = b.created_by WHERE b.barangay_id = ? AND u.username IN (${plan.marker.map(() => '?').join(', ')})`,
      [tenant.barangay_id, ...plan.marker]
    );
    if (Number(marker.n) > 0) {
      summaries.push(`${plan.label}: skipped; demo staff (${plan.marker.join(', ')}) already created ${Number(marker.n)} blotter(s) there.`);
      continue;
    }
    for (const item of plan.walkIns) {
      let blotter = await createBlotter(pool, { intake: item.intake, tenant, actorId: userIds.get(item.by), now: item.at });
      for (const [status, reason] of item.steps) {
        blotter = await changeBlotterStatus(pool, { id: blotter.id, tenantId: tenant.barangay_id, actorId: userIds.get(item.by), status, expectedVersion: blotter.version, reason });
      }
    }
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const item of plan.reports) {
      const created = await createPublicReport(pool, { barangay: { id: tenant.barangay_id, city_id: tenant.city_id }, values: item.values, now: item.submittedAt });
      if (item.outcome === 'approved') {
        await approveResidentReport(pool, { id: created.id, tenant, actorId: userIds.get(item.by), intake: item.intake });
        counts.approved += 1;
      } else if (item.outcome === 'rejected') {
        await rejectResidentReport(pool, { id: created.id, tenantId: tenant.barangay_id, actorId: userIds.get(item.by), reason: item.reason });
        counts.rejected += 1;
      } else counts.pending += 1;
    }
    summaries.push(`${plan.label}: created ${plan.walkIns.length} walk-in blotters and ${counts.approved} blotters from approved resident reports; ${plan.reports.length} resident reports (${counts.pending} pending review, ${counts.approved} approved, ${counts.rejected} rejected).`);
  }
  process.stdout.write(`Demo seed: upserted ${STAFF_ACCOUNTS.length} staff accounts (${STAFF_ACCOUNTS.map(([username]) => username).join(', ')}).\n${summaries.map((line) => `  ${line}`).join('\n')}\nResident names and incidents are fictional; staff accounts use the team's names.\n`);
} catch (error) {
  process.stderr.write(`Demo seed failed: ${error.message}\n`);
  process.exitCode = 1;
} finally { await pool.end(); }
