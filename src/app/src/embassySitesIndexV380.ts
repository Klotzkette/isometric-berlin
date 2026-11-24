type Host = {id: string; bounds: [number, number, number, number]};

export const embassyHostsV380: Host[] = [
  {id: "embassy380-es", bounds: [-1820, 888, -1747, 953]},
  {id: "embassy380-kp", bounds: [897, 812, 981, 852]},
  {id: "embassy380-cn", bounds: [3053, 620, 3118, 697]},
];
export const embassyIdsV380: ReadonlySet<string> = new Set(embassyHostsV380.map(host => host.id));
