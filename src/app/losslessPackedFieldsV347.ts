/** V347 finite source-only encoding. Direct eager fields keep their original
 * strongly retained object identity; there are no getters or weak caches.
 * Exact raw and field hashes prevent accidental broadening to changed sources. */
import { createHash } from "node:crypto";
export const LOSSLESS_PACKED_PINS_V347: Readonly<Record<string, {
  sourceSha256: string; fields: Readonly<Record<string, { sha256: string; bytes: number }>>;
}>> = {
  "data/altMitteV169Native/packet-007.json": {
    "sourceSha256": "00fdee1224bdd6a72f0603106cb2b18f274e98e50847bc28e85d9483f0536e2e",
    "fields": {
      "meshes": {
        "sha256": "8d217fb915872ffa96c5b8d437cd0e9c97a456c6d16f10f1055162a591a24cb3",
        "bytes": 829794
      }
    }
  },
  "data/altMitteV169Native/packet-008.json": {
    "sourceSha256": "7a65451955cbedb3a2c770cddb215d2c971c98755cc7502edee990f43febbc6a",
    "fields": {
      "meshes": {
        "sha256": "0f7b7769bac5b6e97902c63b9f9c77a9445a1afdbc9e921315ed48e4b2c82725",
        "bytes": 841770
      }
    }
  },
  "data/altMitteV169Native/packet-048.json": {
    "sourceSha256": "3f8380b4d3d0fe768acf04b5b3d50c4a271e3d564749afeac5e4a67a36c85e6a",
    "fields": {
      "meshes": {
        "sha256": "e8700ca88f4a2e6a8c0f88e0e9ad585f94002af84c1b553c62401ad1b676c7a7",
        "bytes": 824238
      }
    }
  },
  "data/altMitteV169Native/packet-058.json": {
    "sourceSha256": "b9cc510f0865637b0e2845aea4d40b6c8dd9374d071848cfaee064611f3b5751",
    "fields": {
      "meshes": {
        "sha256": "866e8925323bde2a5d38747952ac3e1d84f8ff7db1f0952c38af16bd4b6811aa",
        "bytes": 823242
      }
    }
  },
  "data/altMitteV169Native/packet-063.json": {
    "sourceSha256": "914994f02f1b3b1c39a9b88ea58db2699ae6fc9bb9bb6611e8d370aec553e828",
    "fields": {
      "meshes": {
        "sha256": "3e8c0886997f345407a8e30b904d3b94de4d5ea32da6fbfeecd1e8a94545b2bb",
        "bytes": 825870
      }
    }
  },
  "data/altMitteV169Native/packet-064.json": {
    "sourceSha256": "d75768beef812de4f5d5c09a34cd708333ef60117a4ce8b8c405c178b8bda6a5",
    "fields": {
      "meshes": {
        "sha256": "d6345bba67b8f20ecf6a4eb9a167828b7f7e4d77463cdeda6c7c9cb2050b0d0e",
        "bytes": 832566
      }
    }
  },
  "data/altMitteV169Native/packet-066.json": {
    "sourceSha256": "ebd08050f8075827c9ed877eefc08a23d001eb9b97b89bc37caf020dd012bcc9",
    "fields": {
      "meshes": {
        "sha256": "079e8204a6f87df5896e4a9dcef80b12d2470a8f7320b9c82b38dc41e96e6d0a",
        "bytes": 823446
      }
    }
  },
  "data/altMitteV169Native/packet-068.json": {
    "sourceSha256": "31f4bf2d140c33d5cc5f4a92bc540f1cd71ac487890404c9b852349bad2372a3",
    "fields": {
      "meshes": {
        "sha256": "e07d3974a53b4f11a5fd225be97ba7ea8d6644b91043d24bdf16b090bc4a332e",
        "bytes": 826518
      }
    }
  },
  "data/altMitteV169Native/packet-070.json": {
    "sourceSha256": "cd86d7345998c70b795bc55a413417854f27a848c3afc5bb62737a1df525aab0",
    "fields": {
      "meshes": {
        "sha256": "cd0767d6ed9fcd4e86b82dc987c8fe96f24bd1ec700ff25cf185410d3fd129aa",
        "bytes": 822966
      }
    }
  },
  "data/altMitteV169Native/packet-046.json": {
    "sourceSha256": "a810a09cfe18ec853cebb74db0384de3a56129e4451a50a4eb06434d10e001e7",
    "fields": {
      "meshes": {
        "sha256": "f405c22612bb38632f193d6e86fca6cba9c4ebd89d6c4b060f4dcc82cbdcae0f",
        "bytes": 824202
      }
    }
  },
  "data/namedGravesV347.json": {
    "sourceSha256": "c5e71e9f1182d9a948f91694b23d8d9a10445aa2d1ffee37f4ed4efb338f98f4",
    "fields": {
      "sites": {
        "sha256": "618903f1ed133f8346a960bbcbcee1489c2fae8c9f0317c366b3a0497774c15e",
        "bytes": 744581
      }
    }
  }
};
for (const pin of Object.values(LOSSLESS_PACKED_PINS_V347)) {
  for (const field of Object.values(pin.fields)) Object.freeze(field);
  Object.freeze(pin.fields);
  Object.freeze(pin);
}
Object.freeze(LOSSLESS_PACKED_PINS_V347);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export function exactPackedFieldsV347(path: string, source: string): readonly string[] {
  const pin = LOSSLESS_PACKED_PINS_V347[path];
  if (!pin) return [];
  if (hash(source) !== pin.sourceSha256) throw new Error("Changed exact V347 strong source: " + path);
  return Object.keys(pin.fields);
}
export function assertPackedFieldV347(path: string, key: string, value: string): void {
  const pin = LOSSLESS_PACKED_PINS_V347[path]?.fields[key];
  if (!pin || Buffer.byteLength(value) !== pin.bytes || hash(value) !== pin.sha256) {
    throw new Error("Changed exact V347 strong field: " + path + ":" + key);
  }
}
