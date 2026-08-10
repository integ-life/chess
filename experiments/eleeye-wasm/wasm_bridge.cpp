#include <stdint.h>
#include <string.h>

#include <emscripten/emscripten.h>

#include "pregen.h"
#include "position.h"
#include "hash.h"
#include "search.h"

namespace {
bool initialized = false;
char bestMove[5] = {0, 0, 0, 0, 0};
}

extern "C" {

EMSCRIPTEN_KEEPALIVE int eleeye_init() {
  if (initialized) {
    return 1;
  }

  PreGenInit();
  NewHash(24);
  Search.pos.FromFen(cszStartFen);
  Search.pos.nDistance = 0;
  Search.pos.PreEvaluate();
  Search.nBanMoves = 0;
  Search.bQuit = Search.bPonder = Search.bDraw = false;
  Search.bBatch = true;
  Search.bDebug = Search.bUseBook = Search.bIdle = false;
  Search.bUseHash = Search.bNullMove = Search.bKnowledge = true;
  Search.nGoMode = GO_MODE_INFINITY;
  Search.nNodes = 0;
  Search.nCountMask = 4095;
  Search.nRandomMask = 0;
  Search.rc4Random.InitRand();
  initialized = true;
  return 1;
}

EMSCRIPTEN_KEEPALIVE const char *eleeye_bestmove(const char *fen, int depth) {
  if (!initialized || fen == nullptr || depth < 1 || depth > 20) {
    return nullptr;
  }

  Search.pos.FromFen(fen);
  Search.pos.nDistance = 0;
  Search.pos.PreEvaluate();
  Search.nBanMoves = 0;
  Search.bDraw = Search.bPonder = false;
  Search.nGoMode = GO_MODE_INFINITY;
  Search.mvResult = 0;
  SearchMain(depth);
  if (Search.mvResult == 0) {
    return nullptr;
  }

  const uint32_t coord = MOVE_COORD(Search.mvResult);
  memcpy(bestMove, &coord, 4);
  bestMove[4] = '\0';
  return bestMove;
}

}
