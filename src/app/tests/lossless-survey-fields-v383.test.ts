import { expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { encodeSurveyFieldV383,surveyLayoutsV383 } from "../losslessSurveyFieldsV383";
import { decodeLosslessGzipJson } from "../src/losslessSurveyFieldV383";

test("all four existing binary survey strings return byte-for-byte with smaller downloads",()=>{
  for(const [name,fields] of Object.entries(surveyLayoutsV383)){
    const source=JSON.parse(readFileSync(new URL("../src/data/"+name,import.meta.url),"utf8"));
    for(const [key,layout] of Object.entries(fields)){
      const value=source[key],encoded=encodeSurveyFieldV383(value,layout)!;
      expect(encoded).toBeDefined();
      expect(Buffer.from(encoded[0],"base64")[9]).toBe(0x13);
      expect(decodeLosslessGzipJson(encoded)).toBe(value);
      const before=gzipSync(value,{level:9}),after=gzipSync(JSON.stringify(encoded),{level:9});
      expect(after.length).toBeLessThan(before.length);
      const [,length,width,delta]=encoded;
      expect(()=>decodeLosslessGzipJson([encoded[0],length-width,width,delta])).toThrow();
    }
  }
  expect(encodeSurveyFieldV383("AQF=",[4,false])).toBeUndefined();
  expect(encodeSurveyFieldV383("AQA=",[4,false])).toBeUndefined();
});

test("older WebKit and Windows engines can restore multi-chunk base64 including its final padding", () => {
  const prototype = Uint8Array.prototype as Uint8Array & {toBase64?: () => string};
  const original = Object.getOwnPropertyDescriptor(prototype,"toBase64");
  try {
    Object.defineProperty(prototype,"toBase64",{value:undefined,configurable:true});
    for (const padding of [0,4,8]) {
      const bytes = Buffer.alloc(3*12288+padding);
      for (let i=0;i<bytes.length;i++) bytes[i]=(i>>6)&255;
      const value=bytes.toString("base64");
      expect(decodeLosslessGzipJson(encodeSurveyFieldV383(value,[4,false])!)).toBe(value);
    }
  } finally {
    if (original) Object.defineProperty(prototype,"toBase64",original);
    else delete prototype.toBase64;
  }
});
