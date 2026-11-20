import type { SurveyedPavingBank } from "./surveyedPavingV368";
import owners from "./data/surveyedPavingOwnersV368.json";
import bank0 from "./data/surveyedPavingV368_-1_-1.json";
import bank1 from "./data/surveyedPavingV368_-1_-2.json";
import bank2 from "./data/surveyedPavingV368_-1_1.json";
import bank3 from "./data/surveyedPavingV368_-1_2.json";
import bank4 from "./data/surveyedPavingV368_-1_3.json";
import bank5 from "./data/surveyedPavingV368_-2_-1.json";
import bank6 from "./data/surveyedPavingV368_-2_-2.json";
import bank7 from "./data/surveyedPavingV368_-2_0.json";
import bank8 from "./data/surveyedPavingV368_-2_1.json";
import bank9 from "./data/surveyedPavingV368_-2_2.json";
import bank10 from "./data/surveyedPavingV368_-2_3.json";
import bank11 from "./data/surveyedPavingV368_-2_4.json";
import bank12 from "./data/surveyedPavingV368_-3_-1.json";
import bank13 from "./data/surveyedPavingV368_-3_0.json";
import bank14 from "./data/surveyedPavingV368_-3_1.json";
import bank15 from "./data/surveyedPavingV368_-3_2.json";
import bank16 from "./data/surveyedPavingV368_-3_3.json";
import bank17 from "./data/surveyedPavingV368_-4_-1.json";
import bank18 from "./data/surveyedPavingV368_-4_0.json";
import bank19 from "./data/surveyedPavingV368_-4_1.json";
import bank20 from "./data/surveyedPavingV368_-5_-1.json";
import bank21 from "./data/surveyedPavingV368_-5_0.json";
import bank22 from "./data/surveyedPavingV368_-7_3.json";
import bank23 from "./data/surveyedPavingV368_-7_4.json";
import bank24 from "./data/surveyedPavingV368_-7_5.json";
import bank25 from "./data/surveyedPavingV368_-8_4.json";
import bank26 from "./data/surveyedPavingV368_-8_5.json";
import bank27 from "./data/surveyedPavingV368_-9_4.json";
import bank28 from "./data/surveyedPavingV368_-9_5.json";
import bank29 from "./data/surveyedPavingV368_0_-1.json";
import bank30 from "./data/surveyedPavingV368_0_-2.json";
import bank31 from "./data/surveyedPavingV368_0_-3.json";
import bank32 from "./data/surveyedPavingV368_0_1.json";
import bank33 from "./data/surveyedPavingV368_0_2.json";
import bank34 from "./data/surveyedPavingV368_1_-1.json";
import bank35 from "./data/surveyedPavingV368_1_-2.json";
import bank36 from "./data/surveyedPavingV368_1_-3.json";
import bank37 from "./data/surveyedPavingV368_1_-4.json";
import bank38 from "./data/surveyedPavingV368_1_0.json";
import bank39 from "./data/surveyedPavingV368_1_1.json";
import bank40 from "./data/surveyedPavingV368_1_2.json";
import bank41 from "./data/surveyedPavingV368_2_-1.json";
import bank42 from "./data/surveyedPavingV368_2_-2.json";
import bank43 from "./data/surveyedPavingV368_2_0.json";
import bank44 from "./data/surveyedPavingV368_2_1.json";
import bank45 from "./data/surveyedPavingV368_2_2.json";
import bank46 from "./data/surveyedPavingV368_3_-1.json";
import bank47 from "./data/surveyedPavingV368_3_0.json";
import bank48 from "./data/surveyedPavingV368_3_1.json";

const banks = {
  "-1_-1": bank0,
  "-1_-2": bank1,
  "-1_1": bank2,
  "-1_2": bank3,
  "-1_3": bank4,
  "-2_-1": bank5,
  "-2_-2": bank6,
  "-2_0": bank7,
  "-2_1": bank8,
  "-2_2": bank9,
  "-2_3": bank10,
  "-2_4": bank11,
  "-3_-1": bank12,
  "-3_0": bank13,
  "-3_1": bank14,
  "-3_2": bank15,
  "-3_3": bank16,
  "-4_-1": bank17,
  "-4_0": bank18,
  "-4_1": bank19,
  "-5_-1": bank20,
  "-5_0": bank21,
  "-7_3": bank22,
  "-7_4": bank23,
  "-7_5": bank24,
  "-8_4": bank25,
  "-8_5": bank26,
  "-9_4": bank27,
  "-9_5": bank28,
  "0_-1": bank29,
  "0_-2": bank30,
  "0_-3": bank31,
  "0_1": bank32,
  "0_2": bank33,
  "1_-1": bank34,
  "1_-2": bank35,
  "1_-3": bank36,
  "1_-4": bank37,
  "1_0": bank38,
  "1_1": bank39,
  "1_2": bank40,
  "2_-1": bank41,
  "2_-2": bank42,
  "2_0": bank43,
  "2_1": bank44,
  "2_2": bank45,
  "3_-1": bank46,
  "3_0": bank47,
  "3_1": bank48
} as unknown as Readonly<Record<string, SurveyedPavingBank>>;
const locations: Readonly<Record<string, string>> = owners;

export function synchronousSurveyedPavingV368(id: string) {
  return banks[locations[id]]?.[id];
}
