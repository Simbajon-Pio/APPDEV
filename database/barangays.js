// Official barangay names taken from the Wikipedia barangay lists for each city
// (en.wikipedia.org/wiki/List_of_barangays_in_Cebu_City, /wiki/Mandaue, /wiki/Lapu-Lapu_City; retrieved 2026-11-05).
// Parenthetical alternate names are dropped, e.g. "Santo Niño (Poblacion)" is stored as "Santo Niño".
export const CITIES = [
  {
    name: 'Cebu City', slug: 'cebu-city', prefix: 'CEB',
    barangays: [
      'Adlaon', 'Agsungot', 'Apas', 'Babag', 'Bacayan', 'Banilad', 'Basak Pardo', 'Basak San Nicolas', 'Binaliw', 'Bonbon',
      'Budlaan', 'Buhisan', 'Bulacao', 'Buot', 'Busay', 'Calamba', 'Cambinocot', 'Capitol Site', 'Carreta', 'Cogon Pardo',
      'Cogon Ramos', 'Day-as', 'Duljo Fatima', 'Ermita', 'Guadalupe', 'Guba', 'Hipodromo', 'Inayawan', 'Kalubihan', 'Kalunasan',
      'Kamagayan', 'Kamputhaw', 'Kasambagan', 'Kinasang-an Pardo', 'Labangon', 'Lahug', 'Lorega San Miguel', 'Lusaran', 'Luz', 'Mabini',
      'Mabolo', 'Malubog', 'Mambaling', 'Pahina Central', 'Pahina San Nicolas', 'Pamutan', 'Pari-an', 'Paril', 'Pasil', 'Pit-os',
      'Poblacion Pardo', 'Pulangbato', 'Pung-ol Sibugay', 'Punta Princesa', 'Quiot Pardo', 'Sambag I', 'Sambag II', 'San Antonio', 'San Jose', 'San Nicolas Proper',
      'San Roque', 'Santa Cruz', 'Santo Niño', 'Sapangdaku', 'Sawang Calero', 'Sinsin', 'Sirao', 'Suba', 'Sudlon I', 'Sudlon II',
      'T. Padilla', 'Tabunan', 'Tagba-o', 'Talamban', 'Taptap', 'Tejero', 'Tinago', 'Tisa', 'To-ong', 'Zapatera'
    ]
  },
  {
    name: 'Mandaue City', slug: 'mandaue-city', prefix: 'MAN',
    barangays: [
      'Alang-alang', 'Bakilid', 'Banilad', 'Basak', 'Cabancalan', 'Cambaro', 'Canduman', 'Casili', 'Casuntingan', 'Centro',
      'Cubacub', 'Guizo', 'Ibabao-Estancia', 'Jagobiao', 'Labogon', 'Looc', 'Maguikay', 'Mantuyong', 'Opao', 'Paknaan',
      'Pagsabungan', 'Subangdaku', 'Tabok', 'Tawason', 'Tingub', 'Tipolo', 'Umapad'
    ]
  },
  {
    name: 'Lapu-Lapu City', slug: 'lapu-lapu-city', prefix: 'LLC',
    barangays: [
      'Agus', 'Babag', 'Bankal', 'Baring', 'Basak', 'Buaya', 'Calawisan', 'Canjulao', 'Caubian', 'Caw-oy',
      'Cawhagan', 'Gun-ob', 'Ibo', 'Looc', 'Mactan', 'Maribago', 'Marigondon', 'Pajac', 'Pajo', 'Pangan-an',
      'Poblacion', 'Punta Engaño', 'Pusok', 'Sabang', 'San Vicente', 'Santa Rosa', 'Subabasbas', 'Talima', 'Tingo', 'Tungasan'
    ]
  }
];

export const EXPECTED_BARANGAY_COUNTS = { 'cebu-city': 80, 'mandaue-city': 27, 'lapu-lapu-city': 30 };
