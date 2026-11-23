export default {
  "sheets": {
    "lin-jump": {
      "file": "art/lin-jump.webp",
      "sha256": "b34eb88d77e56a8ab4bc8cebe4fa0646464278c908afe08822a849a550d927e4",
      "width": 768,
      "height": 576
    }
  },
  "fighters": {
    "lin": {
      "cels": {
        "jump/takeoff": {
          "id": "lin",
          "key": "jump/takeoff",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "lin-jump",
              "from": [
                322,
                18,
                136,
                252
              ],
              "to": [
                -31,
                -126,
                68,
                126
              ]
            }
          ]
        },
        "jump/rise": {
          "id": "lin",
          "key": "jump/rise",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "lin-jump",
              "from": [
                576,
                24,
                128,
                244
              ],
              "to": [
                -32,
                -123,
                64,
                122
              ]
            }
          ]
        },
        "jump/apex": {
          "id": "lin",
          "key": "jump/apex",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "lin-jump",
              "from": [
                78,
                340,
                116,
                176
              ],
              "to": [
                -25,
                -109,
                58,
                88
              ]
            }
          ]
        },
        "jump/descent": {
          "id": "lin",
          "key": "jump/descent",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "lin-jump",
              "from": [
                324,
                334,
                142,
                224
              ],
              "to": [
                -30,
                -112,
                71,
                112
              ]
            }
          ]
        },
        "land/absorb": {
          "id": "lin",
          "key": "land/absorb",
          "acceptance": "held",
          "rehearsal": "fit",
          "parts": [
            {
              "sheet": "lin-jump",
              "from": [
                566,
                358,
                164,
                200
              ],
              "to": [
                -37,
                -100,
                82,
                100
              ]
            }
          ]
        }
      }
    }
  }
};
