#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const db = resolve(process.argv[2] ?? `${root}/backend/qipu-dataset.db`)
const output = resolve(process.argv[3] ?? `${root}/frontend/src/qipu/catalog-data.json`)
const courseOutput = resolve(process.argv[4] ?? `${root}/frontend/src/opening/examples-data.json`)
const matesOutput = resolve(process.argv[5] ?? `${root}/frontend/src/course/mates-examples.json`)
const tacticsOutput = resolve(process.argv[6] ?? `${root}/frontend/src/course/tactics-examples.json`)
const endgamesOutput = resolve(process.argv[7] ?? `${root}/frontend/src/course/endgames-examples.json`)
const middlegameOutput = resolve(process.argv[8] ?? `${root}/frontend/src/course/middlegame-examples.json`)
const middlegamePlansOutput = resolve(process.argv[9] ?? `${root}/frontend/src/course/middlegame-plans-examples.json`)
const practiceOutput = resolve(process.argv[10] ?? `${root}/frontend/src/course/practice-examples.json`)
const tacticsTransferOutput = resolve(process.argv[11] ?? `${root}/frontend/src/course/tactics-transfer-examples.json`)
const matesTransferOutput = resolve(process.argv[12] ?? `${root}/frontend/src/course/mates-transfer-examples.json`)
const middlegameTransferOutput = resolve(process.argv[13] ?? `${root}/frontend/src/course/middlegame-transfer-examples.json`)
const middlegamePlansTransferOutput = resolve(process.argv[14] ?? `${root}/frontend/src/course/middlegame-plans-transfer-examples.json`)
const endgamesTransferOutput = resolve(process.argv[15] ?? `${root}/frontend/src/course/endgames-transfer-examples.json`)

function query(sql) {
  const raw = execFileSync('sqlite3', ['-json', db, sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return raw.trim() ? JSON.parse(raw) : []
}

const categories = query(`
  WITH collection_counts AS (
    SELECT category, collection, COUNT(*) AS game_count
    FROM qipu_games
    WHERE category <> '' AND collection <> ''
    GROUP BY category, collection
  ), ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY game_count DESC, collection) AS rank
    FROM collection_counts
  )
  SELECT g.category, COUNT(*) AS game_count,
    COALESCE((SELECT json_group_array(json_object('name', r.collection, 'gameCount', r.game_count))
      FROM ranked r WHERE r.category = g.category AND r.rank <= 8), '[]') AS collections
  FROM qipu_games g
  WHERE g.category <> ''
  GROUP BY g.category
  ORDER BY game_count DESC;
`).map((row) => ({
  name: row.category,
  gameCount: row.game_count,
  collections: JSON.parse(row.collections),
  games: [],
}))

const quote = (value) => `'${value.replaceAll("'", "''")}'`
const selectedCollections = categories
  .flatMap((category) => category.collections.map((collection) => `(${quote(category.name)}, ${quote(collection.name)})`))
  .join(',')

const games = query(`
  WITH selected(category, collection) AS (VALUES ${selectedCollections}),
  candidates AS (
    SELECT g.id, g.category, g.collection, g.title, g.event, g.played_at, g.red_player, g.black_player,
      g.result, g.opening, g.initial_fen,
      (SELECT COUNT(*) FROM qipu_game_edges ge WHERE ge.game_id = g.id) AS plies
    FROM qipu_games g
    JOIN selected s ON s.category = g.category AND s.collection = g.collection
  ), ranked AS (
    SELECT candidates.*,
      ROW_NUMBER() OVER (
        PARTITION BY category, collection
        ORDER BY
          CASE WHEN title <> '' THEN 0 ELSE 1 END,
          CASE WHEN red_player <> '' AND black_player <> '' THEN 0 ELSE 1 END,
          CASE WHEN opening <> '' THEN 0 ELSE 1 END,
          ABS(plies - 80), id
      ) AS game_rank
    FROM candidates
    WHERE plies BETWEEN 4 AND 180
  )
  SELECT c.*,
    (SELECT s.name FROM qipu_game_sources gs JOIN qipu_sources s ON s.id = gs.source_id
      WHERE gs.game_id = c.id ORDER BY s.id LIMIT 1) AS source_name,
    (SELECT gs.source_url FROM qipu_game_sources gs WHERE gs.game_id = c.id
      ORDER BY gs.source_id, gs.source_key LIMIT 1) AS source_url
  FROM ranked c
  WHERE c.game_rank = 1
  ORDER BY c.category, c.collection;
`)

const ids = games.map((game) => `'${game.id.replaceAll("'", "''")}'`).join(',')
const moveRows = query(`
  SELECT ge.game_id, ge.ply, e.move
  FROM qipu_game_edges ge
  JOIN qipu_edges e ON e.id = ge.edge_id
  WHERE ge.game_id IN (${ids})
  ORDER BY ge.game_id, ge.ply;
`)
const movesByGame = Map.groupBy(moveRows, (row) => row.game_id)

for (const game of games) {
  const category = categories.find((item) => item.name === game.category)
  if (!category) continue
  category.games.push({
    id: game.id,
    title: game.title || game.collection,
    collection: game.collection,
    event: game.event,
    playedAt: game.played_at,
    redPlayer: game.red_player,
    blackPlayer: game.black_player,
    result: game.result,
    opening: game.opening,
    initialFen: game.initial_fen,
    moves: (movesByGame.get(game.id) ?? []).map((row) => row.move),
    sourceName: game.source_name,
    sourceUrl: game.source_url,
  })
}

const snapshot = query('SELECT MAX(imported_at) AS imported_at, COUNT(*) AS total FROM qipu_games;')[0]
const catalog = {
  generatedAt: new Date(snapshot.imported_at).toISOString(),
  totalGames: snapshot.total,
  categories,
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`)

const courseThemes = [
  ['four-goals', "opening LIKE 'C23 %'"],
  ['tempo-coordination', "opening LIKE 'C62 %'"],
  ['ecco-transposition', "opening LIKE 'E01 %'"],
  ['screen-horses', "opening LIKE 'C%'"],
  ['cross-river-chariot', "substr(opening, 1, 2) IN ('C3', 'C4')"],
  ['five-seven-cannons', "substr(opening, 1, 2) IN ('C6', 'C7')"],
  ['sandwiched-horse', "opening LIKE 'B%'"],
  ['same-direction-cannons', "substr(opening, 1, 2) IN ('D0', 'D1', 'D2', 'D3', 'D4')"],
  ['opposite-direction-cannons', "substr(opening, 1, 2) IN ('D5', 'D6', 'D7', 'D8', 'D9')"],
  ['pawn-opening', "opening LIKE 'E%'"],
  ['elephant-horse', "substr(opening, 1, 2) IN ('A2', 'A3', 'A4')"],
  ['palace-cannon', "opening LIKE 'A6%'"],
]

const courseExamples = Object.fromEntries(courseThemes.map(([lessonId, openingWhere]) => {
  const game = query(`
    WITH candidate AS (
      SELECT g.*,
        (SELECT COUNT(*) FROM qipu_game_edges ge WHERE ge.game_id = g.id) AS plies,
        (SELECT s.name FROM qipu_game_sources gs JOIN qipu_sources s ON s.id = gs.source_id
          WHERE gs.game_id = g.id ORDER BY s.id LIMIT 1) AS source_name,
        (SELECT gs.source_url FROM qipu_game_sources gs WHERE gs.game_id = g.id
          ORDER BY gs.source_id, gs.source_key LIMIT 1) AS source_url
      FROM qipu_games g
      WHERE (${openingWhere})
        AND g.category IN ('精选', '赛事实战', '开局')
        AND g.red_player <> '' AND g.black_player <> ''
        AND g.result IN ('1-0', '0-1', '1/2-1/2')
    )
    SELECT * FROM candidate
    WHERE plies BETWEEN 40 AND 140
    ORDER BY CASE category WHEN '精选' THEN 0 WHEN '赛事实战' THEN 1 ELSE 2 END,
      CASE WHEN event <> '' THEN 0 ELSE 1 END, ABS(plies - 80), id
    LIMIT 1;
  `)[0]
  if (!game) throw new Error(`no model game found for ${lessonId}`)
  const moves = query(`
    SELECT e.move FROM qipu_game_edges ge
    JOIN qipu_edges e ON e.id = ge.edge_id
    WHERE ge.game_id = ${quote(game.id)} ORDER BY ge.ply;
  `).map((row) => row.move)
  return [lessonId, {
    id: game.id,
    title: game.title || `${game.red_player} 对 ${game.black_player}`,
    event: game.event,
    playedAt: game.played_at,
    redPlayer: game.red_player,
    blackPlayer: game.black_player,
    result: game.result,
    opening: game.opening,
    initialFen: game.initial_fen,
    moves,
    sourceName: game.source_name,
    sourceUrl: game.source_url,
  }]
}))

mkdirSync(dirname(courseOutput), { recursive: true })
writeFileSync(courseOutput, `${JSON.stringify(courseExamples, null, 2)}\n`)

const mateGames = {
  'flying-general': '7185db3fac0d41b9432d2bedfd6e6f0a3780c623a1ffc80b39e48cd375464510',
  'double-rook': 'a9ace6afaf090729bece9a74025f02dc0c6aed92369ef581fbf8ff401600b4cd',
  'double-cannon': '1c29c5f9927815795acd925d7f0d690cb83e6857cad5fa54de5e227731a44b7a',
  'smothered': '1bcb70ecdcdc901209a5bfed00869db9f1fbe52b1dd19e5d97fbdde286cbcb72',
  'reclining-horse': '3653a6bb58fb89d0e76e50acdff435f8f61dec92e79dea40e0b094e82d64baad',
  'corner-horse': '53ca334186e9c54eace31cd30985cf42d73ca8bc17397c949b12d213c69b1a24',
  'horse-cannon': 'c40ff71574be33cbadaacb43ddaacff113497e6edf67e1bddfae72e66f7f30c1',
  'iron-gate': '3e37e6606c98287777d654d43184f52fd82413df160217c3e97c7986a1defbbe',
  'bold-heart': '690eaae3602ea04c7f95979468347ae88914c4246beb4f53d558caf5577357dd',
  stalemate: '6b80cd19952511869b2986d8c2f16b8d8a6f4e30239685b6922f0699bb807e00',
}

const mateTransferGames = {
  'flying-general': '0c556c61c86b915e4c5c659468851acf5d20ee8e5a7991751304821c006601ec',
  'double-rook': 'a411683da144749465454039e9b1d6e4917d260f2862f00339b72080fd5c33fc',
  'double-cannon': '439ff059a2f2bbb2a7629450a6babe7db80ca31c0753c24466b17e9d7c5a1611',
  smothered: '63b66480ed403df32061a2d5ae0c5c181b3422da7bfc9a21f12242e193415179',
  'reclining-horse': '94518e095df819e0be56b0c806ff38694789690d78aa8934531590e8a9a87b03',
  'corner-horse': 'eaf7ce59a426879f640352910d2f0a134706e4b5f68bde031482f0a7ab8a80aa',
  'horse-cannon': '88e6a81137a2edc6c8ebe87c53525a24d9c6b487d404b5be00d5156fb9f53c37',
  'iron-gate': '35e8ff2a3eb1962eefacbc8332fbdf0ddff0755b0d875e0f59868bd019850d55',
  'bold-heart': '516faf636cb9c3421eca0ba34aa11ec051c3e74ffa2979387554804a61d10554',
  stalemate: '0ca160f6b6f9a5bea7ab06246eb11e1d75c3aaf864063649829ff596a264b5f3',
}

function lastFiveExamples(gameIds, kind) {
  return Object.fromEntries(Object.entries(gameIds).map(([lessonId, gameId]) => {
  const game = query(`
    SELECT g.id, g.title, g.result,
      (SELECT COUNT(*) FROM qipu_game_edges ge WHERE ge.game_id = g.id) AS plies,
      (SELECT s.name FROM qipu_game_sources gs JOIN qipu_sources s ON s.id = gs.source_id
        WHERE gs.game_id = g.id ORDER BY s.id LIMIT 1) AS source_name,
      (SELECT gs.source_url FROM qipu_game_sources gs WHERE gs.game_id = g.id
        ORDER BY gs.source_id, gs.source_key LIMIT 1) AS source_url
    FROM qipu_games g WHERE g.id = ${quote(gameId)};
  `)[0]
  if (!game) throw new Error(`no ${kind} example found for ${lessonId}`)
  const firstPly = Math.max(1, game.plies - 4)
  const line = query(`
    SELECT ge.ply, before.fen AS initial_fen, e.move
    FROM qipu_game_edges ge
    JOIN qipu_edges e ON e.id = ge.edge_id
    JOIN qipu_positions before ON before.id = e.from_position_id
    WHERE ge.game_id = ${quote(gameId)} AND ge.ply >= ${firstPly}
    ORDER BY ge.ply;
  `)
  if (line.length !== 5) throw new Error(`${kind} example ${lessonId} has ${line.length} ending plies`)
  return [lessonId, {
    id: game.id,
    title: game.title,
    result: game.result,
    initialFen: line[0].initial_fen,
    moves: line.map((row) => row.move),
    sourceName: game.source_name,
    sourceUrl: game.source_url,
  }]
  }))
}

const mateExamples = lastFiveExamples(mateGames, 'mate')
const mateTransferExamples = lastFiveExamples(mateTransferGames, 'mate transfer')

mkdirSync(dirname(matesOutput), { recursive: true })
writeFileSync(matesOutput, `${JSON.stringify(mateExamples, null, 2)}\n`)
mkdirSync(dirname(matesTransferOutput), { recursive: true })
writeFileSync(matesTransferOutput, `${JSON.stringify(mateTransferExamples, null, 2)}\n`)

const tacticGames = {
  fork: '89a2262448454167faf723db150a1524bd524d36d4fdb15ce78706c4d8ff8885',
  skewer: 'fecf2153db0ef3ae71c87d9ac0f3a2108a0e05fb1d60ed44eada7ced42e81e12',
  pin: 'b215ff0bcddd0fc3189433d9818039c52ed0d11249e54d87946e59fa9d0cf626',
  discovered: '515a64bd54935e5defca85a5d3f39843901795b0853c7ba930fb4fe3c2bdd241',
  deflection: 'd20e77a2f3587437c346e56cff7c2726e1d18a8c0d749efe2ab866372ae400f0',
  blockage: 'ce36236d5567102d66727c40a34b2abbbc1b4c1277b6683fe067f3b96f47f892',
  interference: '2c6533823f15361985cd017858ce03403a2ef0eef0d42455cb97dc97c4e9f482',
  defender: 'f485ad568485353e395e34cc807e90f23840d934eacf62ca4f33a1a1d347e467',
  exchange: 'b91687d7b3ef2dd92a9263653e8f0c5f7229e43404516ccf63299f933efe915c',
  zwischenzug: '7adec8483cad4b4de0582613559532aeae10c63d5940fc626b5a3c0f1ac10b14',
}

const tacticTransferGames = {
  fork: '0fadaebba947bc1399a53ebb948cfe6eccd9060e6de0685ae1f6c7faea876552',
  skewer: 'f7b87199510e0d66a7d19876d51df69f6fc02c3e978eb5f2977f1250c0b654aa',
  pin: '7e0c66ac1b8c81f29cf8adc12b5dacb768301f5d812cb1f47a4d908ab441a615',
  discovered: 'dfae12d05b1e3e4e9e4a603365e31190abddddce1c440f9bc50e21fc8ba5d886',
  deflection: 'f8d452e49b8e379eeb4585614ecf728b8c1219b9e25f00bc8045b3f64935a708',
  blockage: 'd6dad61b1202f43aa08fdd1ae4e896386dda6218e39e28866c6a6b673dfed152',
  interference: 'ddf17877cd534229eeeecd025759955531d813939d8a4aa1c08bcede3cfc884e',
  defender: '103a733603d872136b015068bc0723a15b4e41bb88ec20f9d247f2faa0fa540f',
  exchange: 'edef98bdd0da9b333531ed42215d082365cc948638b1faf792cb636d190a8049',
  zwischenzug: 'ac8e7d7c378c5a780cf7ce8772f1a888cfe3f9cb268f61a24cf8ad2df925b94a',
}

const endgameGames = {
  'king-activity': '0602bea35fffcc32d6dbc15bb1ef1c595cf956a2d44b640affba592614fbbe27',
  'pawn-value': '073f2b8f9c360dfbf259aa54458e2458e0ec65937049453d364e00bd450273c4',
  waiting: '4a0ccb212f5c43991b8d836c5b73d790af398de14ff716a3d8c4ac28cd42f085',
  fortress: '24df54814de59a9d694d1d6f2d65ff3a910667f93707ceb37afa1d3f0ba8a008',
  'pawn-defense': 'afe4cda1f38b042a280d076b17d183a8d2d76c8549f9b688fb9e6196b740b535',
  'two-pawns': 'c521afc5ad0cac6bb080ca71f1aeb8d996be22f732dfdac04c981e5f4fdd8228',
  horse: '4996c7d66f75af4e59385e51af7e39feb8630b77239fa7516ea40a5f1904eec3',
  cannon: '15d8199ceca5b96435f7addd37e36387430abca113b811985dcf2ddeae3d1ef7',
  rook: '276451d8baed847f92f214186734d0fbc70ff59e3f752ad60eacb877c1cb3c79',
  'rook-pawn': '39bc87e6b1a99cd2c135b22ac01a7ea9a5e00be79f75c8f966a7647f2c853de8',
  'mixed-rook': '59e9d6d1bcc8ed2e114fc2ca42b4c85ca3e9bb0cc044bb33010fdd05e73afcad',
  'cannon-pawn': '05d9353d344ca542370891c018a97b9bf89ee0feb28b47fd65261c6f44d491a3',
  'horse-pawn': 'be4b6bfa0a4c6523fffb1aa0594bde7dfe56f77200650f2c733a688734fc03ce',
  'many-pawns': '004324fe969bf6318920be075e5398bd4c683a3934c2dfe264cf3a99913dbee3',
  exchange: 'dff5da38b94c9728412706a737d1de496a4a34fbe0ce904f14ef92efd10ee3c5',
  defense: '03b34dbb71f5b92774966d5848ceed4ff073f62050bfd090734e6d9f757ae7c8',
}

const endgameTransferGames = {
  'king-activity': '8d5c22eb635129492ba9380b115528e6668a197fcb32141856ddbeb090720ee3',
  'pawn-value': '089636eb4da34dee54c2e9c5561542745ba99fb48a8024848e06ca8b4f06103c',
  waiting: 'c87a538575c204da0c911519b702ae3a0c66d193c137dc511dc43ceca7b494fb',
  fortress: '6a8da3f600722064eb08a67262a7c6d6f1f8420c46587ee555b08150344b73a5',
  'pawn-defense': '9ab7bf6c7f8c79eaf9fabc6aa63ea4ed923f04972ce487bce9f10468d637f361',
  'two-pawns': '25dfad60a781101c23b0e5d46fa2c66be9cadac7c07940a342897afa02ca2a46',
  horse: '5ef7e78b521fe8ecd453fe049ca6e23b8afc18bf02fdf85b3d3e5a6dc7be50b5',
  cannon: 'fbbbf5d76a81108a315c0bb9f443368734b0b96e5497629b7172c7adf55301ba',
  rook: '589a526cab8d7f22012b892e448e0273eb003327d28c46060dd47244b00c67fe',
  'rook-pawn': '8667d74a4663d02f5d5415bf55e01aa536dd934e7cc5ca06fbf30f34331cec6e',
  'mixed-rook': 'd1122303e408143d9e165d358699161d6454b4983680cff59dd8b4c2b39a9136',
  'cannon-pawn': '482f527b9865d1befaedf75896bb667e9778b6a27783833712f56a035659c69c',
  'horse-pawn': 'a6d6532459835c8b58f36ef26a00b620a6716970cbcd7d2497023f6dc34cc302',
  'many-pawns': 'b0fc9dafe9622284eaa971630bc644ddf818b713709f0ae2c8284d19e65f2854',
  exchange: 'a177b0939f18e7e673e7bef10fc1c8b19c2d5582bfbf5b95cac08172ccb67ab4',
  defense: '9f0d0e4573827b84f1078560d6dcce4486c672e898bcf250afb66e0c99935115',
}

const middlegameGames = {
  material: '0e870fbc594c5a6f525f3d438b9079976d019b6aefb50498fb5510a490417b0e',
  initiative: 'c8e29798aa5c2d14dc94d000a11f8915ea206703b4eb878c7d9471654db17b78',
  'worst-piece': '0631575478e13d9f121b8006606438de4b7ec8371dc31647a5da8d3d4df0115f',
  'open-lines': 'ed94db661836973d1b211329efbcd23323f34a7e7889649786d328749bdab7e6',
  'horse-quality': 'f7263a44105995b93fbcc5992bdb4e17eea0a9016e146017aa3072d964dc45b9',
  'cannon-position': '344784d0f3bdbd495d9be8044dd96d6403b82d5ed84f54ffd50c7bcf4e6cced0',
  'pawn-structure': '0c068d55de57ebafb8106e7fa0079f9310f1b8cb2fad2ab8238636dfc2b9e354',
  'king-safety': 'db95d42285932c5e87e03ef42260f9c332ee0849c7749d2420d1b76c7d40dcff',
  simplify: '5c9b4c8ba247af8d8f3332651a18e7922c34246a1ea3f535caea9ad490ba2777',
  counterplay: 'bf31a4f1ad034fd751cddf19bc60dc4ba93d13b6f31bea8d788fbb409bb0ebaf',
}

const middlegameTransferGames = {
  material: 'c74d4d2d9c0a72f6e4a1449b337aca84ad8881b833eb2f5f759fd40e8befe5cd',
  initiative: '550fdf5fe874e7366b453d8e86d32d2eb8c4f39c032a9e78032cd3703732ba5f',
  'worst-piece': 'de4c5ec44647c84aae61225c239077c918db60cf217eb0e092488aeb1a552cf1',
  'open-lines': '10df7854ec4588306bc4b264a458fd76f18bbd1d4f0da231491db2dcc0142341',
  'horse-quality': 'e7bba805c4db53eb25bee9de28f6690385998544b6714c1f59ec80070315ccf3',
  'cannon-position': 'f417b4342245caacddaac0a7c7d5cba8765c5842c6660c68cfdc1b36413f9684',
  'pawn-structure': 'b0f209b06de5a2a88aedaeac6ac2d86c1714c3b2570fb9c27668fa395f5e7d24',
  'king-safety': 'b9d47088307cf7af69714b0fedcf85b3e8d4c43fe7d562bfc9f8bec85c8fdd96',
  simplify: '7467f45ebd7dcf95181b34583a04c6f07476c661826daa9e0732dcdf6c27f6c0',
  counterplay: '09dee69f4521c3a8ad1b099d7ddad5d5c495f6b40e95a482ea26bf58357bbf65',
}

const middlegamePlanGames = {
  concentrate: 'e22fa2ec78440e42984cfa2f0bfbb5793f6fc08864ea9c11b95ca526507aef21',
  'open-lines': '02ace03de3086a28b6a60a459129a80edc9e8517d0be29932c0aa4b6d0e2fc49',
  sacrifice: 'c127e9cc973c0b12243844e8dbeead831746f5ec4ce0e1b397e025b1942a7d0d',
  reinforce: 'd8d7e801bccac35b71369d681f326c360fb6da4d4ce8339c01d68044babbba25',
  'exchange-attacker': '907b9edec126fd6a8f7caf2c1fe9835a35c692bbdaff371312f36eb4d8a2d052',
  counter: '201fa8941c686de9ef1be7d11f68aa32997566b21ed28274dbdb847e0b6b78a7',
  'switch-wings': '50b71d2af99b6f232f5a58f934ffb9dfe91eed125d6fbf4b188c3b7c05e023c4',
  'position-to-tactics': 'ef4b23366fc819c6a4095607229d95bca10c116d2832063bb2158fe4256e8aae',
  'favorable-endgame': 'c049f342ab3fdb9510ff8f5f4caf2e0612d7ce26ba765be26dca35406e19af2c',
  'master-case': '8404c501fd5a00d3af39ba66fbcb2b54f74d5e7e627e1c8f2f8591f6a4d5e8c4',
}

const middlegamePlanTransferGames = {
  concentrate: '92c0dbfc7a555def6b2f2d755e0a0487a90d458f1203379106f2f45deff97d32',
  'open-lines': 'f699285b40ba8dae644226982713989cef90bad09f17eae7eb9b0e9dde4cd15e',
  sacrifice: '159d02ef3aa9235c05626c6342fb1ff5aeff16baf8304c0f110f92f9b431773e',
  reinforce: 'cce753b5df58d622ae860626874bbe866d01f3b5f3d0643561c5d18fa416a3c3',
  'exchange-attacker': 'c11e404dbbe042ddf1035720fc85d300ca0bdb2b4f94b034e34a6866e1af9b8e',
  counter: 'c7dc9cbedfa8743939264415d098fa752a9e6fd445328b3bb1e5fc226b26214e',
  'switch-wings': '55ad749f5c7c832d21e189743956bc79255dafb771ba80e4f3ab5359f5e94ba2',
  'position-to-tactics': '3e770384ce20fb47bf35b14d62f21609f40e7b088278de97a6608707bbcc3291',
  'favorable-endgame': '5cfab2f02ba10930a3d952cd33777e00832d7f38698096a1b214fe25b5b89bf3',
  'master-case': '107e3e5f59ecc5cda8ae1ecfc5c80ab890172412b7aa42dc304feef1b084362e',
}

const practiceGames = {
  candidates: 'c3b9ee9d7ca4cf2df8132462b2f43131809318fe5f2e1101c1cc3f3a983d4cdc',
  'forced-quiet': '9e4ad8a726b0cdb63dc0baba5c8f3687d5c2818eeb1eecc5c8dac43ff6820ea8',
  'best-reply': 'da2ff6dcbee52fed04c6d167c1a52e58d961165b60bc0db30b9ac6ccf4698da2',
  blundercheck: '8e7fbe000eb5fbb14062eaa5516391ae9dc54785195ec4a676a6a2dfc05734cc',
  clock: '31ab9ce958f17c4b5b8b0a7aed309e2c169844615d5e425b5e9c0ac0b6c6f056',
  annotate: '11d8acec023e865c6ab73261eb736cc574cc317ca86a9bc1f92b3d466a1c7b62',
  'self-review': 'a88ac600a3add199a487cdc48b67e3db87217441bd82630b47b91ee1cb4fc4d4',
  'engine-review': 'e0dbc87d7d3557ef8673ab9235fd8bf67fda414a5712b081b017198c2fc7f7df',
  repertoire: 'bc4fb6fc672934cfdc0870dd7b38cde83b81940c6725840ee3e2b1af8610e06e',
  graduation: '2ee8175e3f431077a93b7e057284e36188cdc3d680e5e97ffa0e5bd0767136a3',
}

function firstFiveExamples(gameIds, kind, includeFullLine = false) {
  return Object.fromEntries(Object.entries(gameIds).map(([lessonId, gameId]) => {
  const game = query(`
    SELECT g.id, g.title, g.result,
      (SELECT s.name FROM qipu_game_sources gs JOIN qipu_sources s ON s.id = gs.source_id
        WHERE gs.game_id = g.id ORDER BY s.id LIMIT 1) AS source_name,
      (SELECT gs.source_url FROM qipu_game_sources gs WHERE gs.game_id = g.id
        ORDER BY gs.source_id, gs.source_key LIMIT 1) AS source_url
    FROM qipu_games g WHERE g.id = ${quote(gameId)};
  `)[0]
  if (!game) throw new Error(`no ${kind} example found for ${lessonId}`)
  const fullLine = query(`
    SELECT ge.ply, before.fen AS initial_fen, e.move
    FROM qipu_game_edges ge
    JOIN qipu_edges e ON e.id = ge.edge_id
    JOIN qipu_positions before ON before.id = e.from_position_id
    WHERE ge.game_id = ${quote(gameId)}
    ORDER BY ge.ply;
  `)
  const line = fullLine.slice(0, 5)
  if (line.length !== 5) throw new Error(`${kind} example ${lessonId} has ${line.length} opening plies`)
  return [lessonId, {
    id: game.id,
    title: game.title,
    result: game.result,
    initialFen: line[0].initial_fen,
    moves: line.map((row) => row.move),
    sourceName: game.source_name,
    sourceUrl: game.source_url,
    ...(includeFullLine ? { fullMoves: fullLine.map((row) => row.move) } : {}),
  }]
  }))
}

const tacticExamples = firstFiveExamples(tacticGames, 'tactic')
const tacticTransferExamples = firstFiveExamples(tacticTransferGames, 'tactic transfer')
const endgameExamples = firstFiveExamples(endgameGames, 'endgame')
const endgameTransferExamples = firstFiveExamples(endgameTransferGames, 'endgame transfer')
const middlegameExamples = firstFiveExamples(middlegameGames, 'middlegame')
const middlegameTransferExamples = firstFiveExamples(middlegameTransferGames, 'middlegame transfer')
const middlegamePlanExamples = firstFiveExamples(middlegamePlanGames, 'middlegame plan')
const middlegamePlanTransferExamples = firstFiveExamples(middlegamePlanTransferGames, 'middlegame plan transfer')
const practiceExamples = firstFiveExamples(practiceGames, 'practice', true)

mkdirSync(dirname(tacticsOutput), { recursive: true })
writeFileSync(tacticsOutput, `${JSON.stringify(tacticExamples, null, 2)}\n`)
mkdirSync(dirname(tacticsTransferOutput), { recursive: true })
writeFileSync(tacticsTransferOutput, `${JSON.stringify(tacticTransferExamples, null, 2)}\n`)
mkdirSync(dirname(endgamesOutput), { recursive: true })
writeFileSync(endgamesOutput, `${JSON.stringify(endgameExamples, null, 2)}\n`)
mkdirSync(dirname(endgamesTransferOutput), { recursive: true })
writeFileSync(endgamesTransferOutput, `${JSON.stringify(endgameTransferExamples, null, 2)}\n`)
mkdirSync(dirname(middlegameOutput), { recursive: true })
writeFileSync(middlegameOutput, `${JSON.stringify(middlegameExamples, null, 2)}\n`)
mkdirSync(dirname(middlegameTransferOutput), { recursive: true })
writeFileSync(middlegameTransferOutput, `${JSON.stringify(middlegameTransferExamples, null, 2)}\n`)
mkdirSync(dirname(middlegamePlansOutput), { recursive: true })
writeFileSync(middlegamePlansOutput, `${JSON.stringify(middlegamePlanExamples, null, 2)}\n`)
mkdirSync(dirname(middlegamePlansTransferOutput), { recursive: true })
writeFileSync(middlegamePlansTransferOutput, `${JSON.stringify(middlegamePlanTransferExamples, null, 2)}\n`)
mkdirSync(dirname(practiceOutput), { recursive: true })
writeFileSync(practiceOutput, `${JSON.stringify(practiceExamples, null, 2)}\n`)
console.log(`wrote ${output}: ${catalog.totalGames} games, ${games.length} representatives`)
console.log(`wrote ${courseOutput}: ${Object.keys(courseExamples).length} lesson examples`)
console.log(`wrote ${matesOutput}: ${Object.keys(mateExamples).length} lesson examples`)
console.log(`wrote ${matesTransferOutput}: ${Object.keys(mateTransferExamples).length} lesson examples`)
console.log(`wrote ${tacticsOutput}: ${Object.keys(tacticExamples).length} lesson examples`)
console.log(`wrote ${tacticsTransferOutput}: ${Object.keys(tacticTransferExamples).length} lesson examples`)
console.log(`wrote ${endgamesOutput}: ${Object.keys(endgameExamples).length} lesson examples`)
console.log(`wrote ${endgamesTransferOutput}: ${Object.keys(endgameTransferExamples).length} lesson examples`)
console.log(`wrote ${middlegameOutput}: ${Object.keys(middlegameExamples).length} lesson examples`)
console.log(`wrote ${middlegameTransferOutput}: ${Object.keys(middlegameTransferExamples).length} lesson examples`)
console.log(`wrote ${middlegamePlansOutput}: ${Object.keys(middlegamePlanExamples).length} lesson examples`)
console.log(`wrote ${middlegamePlansTransferOutput}: ${Object.keys(middlegamePlanTransferExamples).length} lesson examples`)
console.log(`wrote ${practiceOutput}: ${Object.keys(practiceExamples).length} lesson examples`)
