import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextQuestion} from './interview.mjs';
const cases=[
  [
    "consentimiento",
    {},
    "detenido"
  ],
  [
    "primera",
    {
      "consent": true
    },
    "situacion"
  ],
  [
    "no repetir",
    {
      "consent": true,
      "known": [
        "situacion",
        "interpretacion"
      ],
      "asked": [
        "emocion"
      ]
    },
    "conducta"
  ],
  [
    "omitir",
    {
      "consent": true,
      "skipped": [
        "situacion"
      ]
    },
    "interpretacion"
  ],
  [
    "límite",
    {
      "consent": true,
      "asked": [
        "situacion",
        "interpretacion",
        "emocion",
        "conducta"
      ]
    },
    "resumen"
  ],
  [
    "rumiación",
    {
      "consent": true,
      "repeatedChecking": true
    },
    "detenido"
  ],
  [
    "malestar",
    {
      "consent": true,
      "overload": true
    },
    "detenido"
  ],
  [
    "parar",
    {
      "consent": true,
      "stop": true
    },
    "detenido"
  ],
  [
    "seguridad",
    {
      "consent": true,
      "safetyConcern": true
    },
    "derivar"
  ],
  [
    "contraste voluntario",
    {
      "consent": true,
      "known": [
        "situacion",
        "interpretacion",
        "emocion",
        "conducta",
        "consecuencia"
      ],
      "exploreInterpretation": true
    },
    "evidencia"
  ],
  [
    "no forzar contraste",
    {
      "consent": true,
      "known": [
        "situacion",
        "interpretacion",
        "emocion",
        "conducta",
        "consecuencia"
      ]
    },
    "recursos"
  ]
];
for(const [name,state,expected] of cases)test(name,()=>{const result=nextQuestion(state);assert.equal(result.id??result.status,expected);});
