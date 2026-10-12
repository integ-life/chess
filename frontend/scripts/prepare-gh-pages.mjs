import { copyFileSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')

// Publish the play entry explicitly so direct visits return 200 with sharing metadata.
mkdirSync('dist/play', { recursive: true })
writeFileSync('dist/play/index.html', readFileSync('dist/index.html', 'utf8').replaceAll('https://chess.integ.life/"', 'https://chess.integ.life/play/"'))
