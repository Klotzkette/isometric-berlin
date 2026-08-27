import { describe, expect, test } from "bun:test";

import {
  pedestrianMovementActivation,
  type PedestrianMovementActivation,
} from "../src/navigationInput";

const idle: PedestrianMovementActivation = {
  count: 0,
  key: "",
  lastActivationAt: 0,
};

describe("pedestrian keyboard movement activation", () => {
  test("counts a bounded triple tap on WASD movement keys", () => {
    const first = pedestrianMovementActivation(idle, "w", 1000);
    const second = pedestrianMovementActivation(first, "w", 1160);
    const third = pedestrianMovementActivation(second, "w", 1290);

    expect(third.count).toBe(3);
    expect(third.key).toBe("forward");
  });

  test("treats equivalent WASD and arrow movement keys as one sequence", () => {
    const first = pedestrianMovementActivation(idle, "w", 1000);
    const second = pedestrianMovementActivation(first, "ArrowUp", 1120);
    const third = pedestrianMovementActivation(second, "w", 1240);

    expect(third.count).toBe(3);
    expect(third.key).toBe("forward");
  });

  test("does not mix different movement directions into one triple tap", () => {
    const first = pedestrianMovementActivation(idle, "w", 1000);
    const second = pedestrianMovementActivation(first, "ArrowUp", 1120);
    const third = pedestrianMovementActivation(second, "a", 1240);

    expect(third.count).toBe(1);
    expect(third.key).toBe("left");
  });
});
