-- Hyrule etkinliğine eksik Zelda oyunları eklenir: var olan sürümler ve kişilerin seçimleri olduğu gibi kalır.
-- İki kez çalıştırılırsa aynı oyun tekrar eklenmez.
update public.events e
set options = e.options || coalesce((
  select jsonb_agg(o order by n)
  from jsonb_array_elements($zelda$[
 {
  "id": "z1022",
  "sub": "Famicom Disk System · 1986",
  "year": 1986,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1uii.jpg",
  "label": "The Legend of Zelda",
  "title": "The Legend of Zelda",
  "ext_id": null,
  "rawg_id": 24072,
  "platform": "Famicom Disk System"
 },
 {
  "id": "z1025",
  "sub": "Famicom Disk System · 1987",
  "year": 1987,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1uje.jpg",
  "label": "Zelda II: The Adventure of Link",
  "title": "Zelda II: The Adventure of Link",
  "ext_id": null,
  "rawg_id": 53205,
  "platform": "Famicom Disk System"
 },
 {
  "id": "z1026",
  "sub": "SNES · 1991",
  "year": 1991,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3vzn.jpg",
  "label": "The Legend of Zelda: A Link to the Past",
  "title": "The Legend of Zelda: A Link to the Past",
  "ext_id": null,
  "rawg_id": 25096,
  "platform": "SNES"
 },
 {
  "id": "z8532",
  "sub": "Philips CD-i · 1993",
  "year": 1993,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co60ta.jpg",
  "label": "Link: The Faces of Evil",
  "title": "Link: The Faces of Evil",
  "ext_id": null,
  "rawg_id": -8532,
  "platform": "Philips CD-i"
 },
 {
  "id": "z8533",
  "sub": "Philips CD-i · 1993",
  "year": 1993,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co60tx.jpg",
  "label": "Zelda: The Wand of Gamelon",
  "title": "Zelda: The Wand of Gamelon",
  "ext_id": null,
  "rawg_id": -8533,
  "platform": "Philips CD-i"
 },
 {
  "id": "z1028",
  "sub": "Game Boy · 1993",
  "year": 1993,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3nnt.jpg",
  "label": "The Legend of Zelda: Link's Awakening",
  "title": "The Legend of Zelda: Link's Awakening",
  "ext_id": null,
  "rawg_id": -1028,
  "platform": "Game Boy"
 },
 {
  "id": "z8534",
  "sub": "Philips CD-i · 1996",
  "year": 1996,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1wsk.jpg",
  "label": "Zelda's Adventure",
  "title": "Zelda's Adventure",
  "ext_id": null,
  "rawg_id": -8534,
  "platform": "Philips CD-i"
 },
 {
  "id": "z1027",
  "sub": "Game Boy Color · 1998",
  "year": 1998,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4o47.jpg",
  "label": "The Legend of Zelda: Link's Awakening DX",
  "title": "The Legend of Zelda: Link's Awakening DX",
  "ext_id": null,
  "rawg_id": -1027,
  "platform": "Game Boy Color"
 },
 {
  "id": "z1030",
  "sub": "Nintendo 64 · 2000",
  "year": 2000,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3pah.jpg",
  "label": "The Legend of Zelda: Majora's Mask",
  "title": "The Legend of Zelda: Majora's Mask",
  "ext_id": null,
  "rawg_id": 25924,
  "platform": "Nintendo 64"
 },
 {
  "id": "z1032",
  "sub": "Game Boy Color · 2001",
  "year": 2001,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2tw0.jpg",
  "label": "The Legend of Zelda: Oracle of Seasons",
  "title": "The Legend of Zelda: Oracle of Seasons",
  "ext_id": null,
  "rawg_id": -1032,
  "platform": "Game Boy Color"
 },
 {
  "id": "z1041",
  "sub": "Game Boy Color · 2001",
  "year": 2001,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2tw1.jpg",
  "label": "The Legend of Zelda: Oracle of Ages",
  "title": "The Legend of Zelda: Oracle of Ages",
  "ext_id": null,
  "rawg_id": -1041,
  "platform": "Game Boy Color"
 },
 {
  "id": "z163572",
  "sub": "Game Boy Advance · 2002",
  "year": 2002,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5w9w.jpg",
  "label": "The Legend of Zelda: Four Swords",
  "title": "The Legend of Zelda: Four Swords",
  "ext_id": null,
  "rawg_id": -163572,
  "platform": "Game Boy Advance"
 },
 {
  "id": "z45142",
  "sub": "Nintendo GameCube · 2002",
  "year": 2002,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5zdv.jpg",
  "label": "Ocarina of Time - Master Quest",
  "title": "The Legend of Zelda: Ocarina of Time - Master Quest",
  "ext_id": null,
  "rawg_id": -45142,
  "platform": "Nintendo GameCube"
 },
 {
  "id": "z229416",
  "sub": "Game Boy Advance · 2002",
  "year": 2002,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5x34.jpg",
  "label": "The Legend of Zelda: A Link to the Past",
  "title": "The Legend of Zelda: A Link to the Past",
  "ext_id": null,
  "rawg_id": -229416,
  "platform": "Game Boy Advance"
 },
 {
  "id": "z1034",
  "sub": "Nintendo GameCube · 2004",
  "year": 2004,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob9xf.jpg",
  "label": "Four Swords Adventures",
  "title": "The Legend of Zelda: Four Swords Adventures",
  "ext_id": null,
  "rawg_id": 56093,
  "platform": "Nintendo GameCube"
 },
 {
  "id": "z1035",
  "sub": "Game Boy Advance · 2004",
  "year": 2004,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3nsk.jpg",
  "label": "The Legend of Zelda: The Minish Cap",
  "title": "The Legend of Zelda: The Minish Cap",
  "ext_id": null,
  "rawg_id": 27418,
  "platform": "Game Boy Advance"
 },
 {
  "id": "z134014",
  "sub": "Wii · 2006",
  "year": 2006,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3w1h.jpg",
  "label": "The Legend of Zelda: Twilight Princess",
  "title": "The Legend of Zelda: Twilight Princess",
  "ext_id": null,
  "rawg_id": -134014,
  "platform": "Wii"
 },
 {
  "id": "z1037",
  "sub": "Nintendo DS · 2007",
  "year": 2007,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3ocu.jpg",
  "label": "The Legend of Zelda: Phantom Hourglass",
  "title": "The Legend of Zelda: Phantom Hourglass",
  "ext_id": null,
  "rawg_id": -1037,
  "platform": "Nintendo DS"
 },
 {
  "id": "z4973",
  "sub": "Wii · 2007",
  "year": 2007,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3ocw.jpg",
  "label": "Link's Crossbow Training",
  "title": "Link's Crossbow Training",
  "ext_id": null,
  "rawg_id": -4973,
  "platform": "Wii"
 },
 {
  "id": "z1038",
  "sub": "Nintendo DS · 2009",
  "year": 2009,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3oj6.jpg",
  "label": "The Legend of Zelda: Spirit Tracks",
  "title": "The Legend of Zelda: Spirit Tracks",
  "ext_id": null,
  "rawg_id": -1038,
  "platform": "Nintendo DS"
 },
 {
  "id": "z45143",
  "sub": "Nintendo DSi · 2011",
  "year": 2011,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5w9s.jpg",
  "label": "Four Swords - Anniversary Edition",
  "title": "The Legend of Zelda: Four Swords - Anniversary Edition",
  "ext_id": null,
  "rawg_id": -45143,
  "platform": "Nintendo DSi"
 },
 {
  "id": "z534",
  "sub": "Wii · 2011",
  "year": 2011,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5wrj.jpg",
  "label": "The Legend of Zelda: Skyward Sword",
  "title": "The Legend of Zelda: Skyward Sword",
  "ext_id": null,
  "rawg_id": -534,
  "platform": "Wii"
 },
 {
  "id": "z2909",
  "sub": "Nintendo 3DS · 2013",
  "year": 2013,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3p0j.jpg",
  "label": "A Link Between Worlds",
  "title": "The Legend of Zelda: A Link Between Worlds",
  "ext_id": null,
  "rawg_id": -2909,
  "platform": "Nintendo 3DS"
 },
 {
  "id": "z5314",
  "sub": "Wii U · 2014",
  "year": 2014,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3p0r.jpg",
  "label": "Hyrule Warriors",
  "title": "Hyrule Warriors",
  "ext_id": null,
  "rawg_id": -5314,
  "platform": "Wii U"
 },
 {
  "id": "z8593",
  "sub": "Nintendo 3DS · 2015",
  "year": 2015,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob9x9.jpg",
  "label": "The Legend of Zelda: Majora's Mask 3D",
  "title": "The Legend of Zelda: Majora's Mask 3D",
  "ext_id": null,
  "rawg_id": -8593,
  "platform": "Nintendo 3DS"
 },
 {
  "id": "z11194",
  "sub": "Nintendo 3DS · 2015",
  "year": 2015,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3p1a.jpg",
  "label": "The Legend of Zelda: Tri Force Heroes",
  "title": "The Legend of Zelda: Tri Force Heroes",
  "ext_id": null,
  "rawg_id": -11194,
  "platform": "Nintendo 3DS"
 },
 {
  "id": "z11193",
  "sub": "Nintendo 3DS · 2016",
  "year": 2016,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5j9o.jpg",
  "label": "Hyrule Warriors: Legends",
  "title": "Hyrule Warriors: Legends",
  "ext_id": null,
  "rawg_id": -11193,
  "platform": "Nintendo 3DS"
 },
 {
  "id": "z18017",
  "sub": "Wii U · 2016",
  "year": 2016,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3mqa.jpg",
  "label": "Twilight Princess HD",
  "title": "The Legend of Zelda: Twilight Princess HD",
  "ext_id": null,
  "rawg_id": -18017,
  "platform": "Wii U"
 },
 {
  "id": "z81147",
  "sub": "Nintendo Switch · 2018",
  "year": 2018,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob2j6.jpg",
  "label": "Hyrule Warriors: Definitive Edition",
  "title": "Hyrule Warriors: Definitive Edition",
  "ext_id": null,
  "rawg_id": 58574,
  "platform": "Nintendo Switch"
 },
 {
  "id": "z116419",
  "sub": "Nintendo Switch · 2019",
  "year": 2019,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob88s.jpg",
  "label": "Cadence of Hyrule",
  "title": "Cadence of Hyrule: Crypt of the NecroDancer Featuring the Legend of Zelda",
  "ext_id": null,
  "rawg_id": -116419,
  "platform": "Nintendo Switch"
 },
 {
  "id": "z115284",
  "sub": "Nintendo Switch · 2019",
  "year": 2019,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1qve.jpg",
  "label": "The Legend of Zelda: Link's Awakening",
  "title": "The Legend of Zelda: Link's Awakening",
  "ext_id": null,
  "rawg_id": 292842,
  "platform": "Nintendo Switch"
 },
 {
  "id": "z138343",
  "sub": "Nintendo Switch · 2020",
  "year": 2020,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob22n.jpg",
  "label": "Hyrule Warriors: Age of Calamity",
  "title": "Hyrule Warriors: Age of Calamity",
  "ext_id": null,
  "rawg_id": 490417,
  "platform": "Nintendo Switch"
 },
 {
  "id": "z143614",
  "sub": "Nintendo Switch · 2021",
  "year": 2021,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob8lb.jpg",
  "label": "The Legend of Zelda: Skyward Sword HD",
  "title": "The Legend of Zelda: Skyward Sword HD",
  "ext_id": null,
  "rawg_id": 558974,
  "platform": "Nintendo Switch"
 },
 {
  "id": "z306149",
  "sub": "Nintendo Switch · 2024",
  "year": 2024,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co8d9b.jpg",
  "label": "The Legend of Zelda: Echoes of Wisdom",
  "title": "The Legend of Zelda: Echoes of Wisdom",
  "ext_id": null,
  "rawg_id": 983717,
  "platform": "Nintendo Switch"
 },
 {
  "id": "z338072",
  "sub": "Nintendo Switch 2 · 2025",
  "year": 2025,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob9oy.jpg",
  "label": "Breath of the Wild (Switch 2)",
  "title": "The Legend of Zelda: Breath of the Wild - Nintendo Switch 2 Edition",
  "ext_id": null,
  "rawg_id": -338072,
  "platform": "Nintendo Switch 2"
 },
 {
  "id": "z338073",
  "sub": "Nintendo Switch 2 · 2025",
  "year": 2025,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coav5n.jpg",
  "label": "Tears of the Kingdom (Switch 2)",
  "title": "The Legend of Zelda: Tears of the Kingdom - Nintendo Switch 2 Edition",
  "ext_id": null,
  "rawg_id": -338073,
  "platform": "Nintendo Switch 2"
 },
 {
  "id": "z338085",
  "sub": "Nintendo Switch 2 · 2025",
  "year": 2025,
  "cover": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob9n1.jpg",
  "label": "Hyrule Warriors: Age of Imprisonment",
  "title": "Hyrule Warriors: Age of Imprisonment",
  "ext_id": null,
  "rawg_id": -338085,
  "platform": "Nintendo Switch 2"
 }
]$zelda$::jsonb) with ordinality as t(o, n)
  where not exists (select 1 from jsonb_array_elements(e.options) x where x->>'rawg_id' = o->>'rawg_id')
), '[]'::jsonb)
where e.id = '0c0a1998-0000-4000-8000-000000000001'
returning e.title, jsonb_array_length(e.options) as surum_sayisi;
