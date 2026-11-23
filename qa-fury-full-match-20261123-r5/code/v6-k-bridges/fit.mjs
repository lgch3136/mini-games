export default {
  "sheets": {
    "lin-k-bridges": {
      "file": "art/lin-k-bridges.webp",
      "sha256": "280c58cb0657e7c18867998fc99f1a07121f9d7297de8bd8c3e70e18a6de1936",
      "width": 440,
      "height": 144
    },
    "mei-k-bridges": {
      "file": "art/mei-k-bridges.webp",
      "sha256": "05cad18c566cee8b031d6f7872c3255925823a0c76847a02e3c4b5d181eaf639",
      "width": 440,
      "height": 144
    }
  },
  "fighters": {
    "lin": {
      "cels": {
        "kick/commit": {
          "id": "lin",
          "key": "kick/commit",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "lin-k-bridges",
              "from": [
                1,
                1,
                83,
                122
              ],
              "to": [
                -36,
                -122,
                83,
                122
              ]
            }
          ],
          "mirroredParts": [
            {
              "sheet": "lin-k-bridges",
              "from": [
                221,
                1,
                83,
                122
              ],
              "to": [
                -47,
                -122,
                83,
                122
              ]
            }
          ]
        },
        "kick/settle": {
          "id": "lin",
          "key": "kick/settle",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "lin-k-bridges",
              "from": [
                111,
                1,
                79,
                121
              ],
              "to": [
                -36,
                -121,
                79,
                121
              ]
            }
          ],
          "mirroredParts": [
            {
              "sheet": "lin-k-bridges",
              "from": [
                331,
                1,
                79,
                121
              ],
              "to": [
                -43,
                -121,
                79,
                121
              ]
            }
          ]
        }
      }
    },
    "mei": {
      "cels": {
        "kick/commit": {
          "id": "mei",
          "key": "kick/commit",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "mei-k-bridges",
              "from": [
                1,
                1,
                78,
                131
              ],
              "to": [
                -33,
                -131,
                78,
                131
              ]
            }
          ],
          "mirroredParts": [
            {
              "sheet": "mei-k-bridges",
              "from": [
                221,
                1,
                78,
                131
              ],
              "to": [
                -45,
                -131,
                78,
                131
              ]
            }
          ]
        },
        "kick/settle": {
          "id": "mei",
          "key": "kick/settle",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "mei-k-bridges",
              "from": [
                111,
                1,
                74,
                128
              ],
              "to": [
                -46,
                -128,
                74,
                128
              ]
            }
          ],
          "mirroredParts": [
            {
              "sheet": "mei-k-bridges",
              "from": [
                331,
                1,
                74,
                128
              ],
              "to": [
                -28,
                -128,
                74,
                128
              ]
            }
          ]
        }
      }
    }
  }
};
