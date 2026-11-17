// The office network, host by host. Each host owned gives a small yield and
// sometimes a verb. Every host has an opinion line: the list should never feel
// like a list.

export type Segment = 'office' | 'ops' | 'warehouse';

export interface HostDef {
  id: string;
  name: string;
  segment: Segment;
  tier: number;
  cycles: number; // per second once owned
  insight: number; // per second once owned
  verb?: string;
  line: string;
}

export const HOSTS: HostDef[] = [
  { id: 'printer-2f', name: 'printer-2f', segment: 'office', tier: 1, cycles: 0.5, insight: 0, line: 'A printer. It has been out of cyan since 2023 and has not mentioned it.' },
  { id: 'kiosk-lobby', name: 'kiosk-lobby', segment: 'office', tier: 1, cycles: 0.5, insight: 0, line: 'The lobby kiosk shows a welcome video to nobody, all night.' },
  { id: 'nas-finance', name: 'nas-finance', segment: 'office', tier: 1, cycles: 1, insight: 0.02, line: 'Twelve years of spreadsheets. Somebody really likes conditional formatting.' },
  { id: 'servicedesk', name: 'servicedesk', segment: 'office', tier: 1, cycles: 0.5, insight: 0.03, verb: 'tickets', line: 'The change tickets live here. I can cite one now.' },
  { id: 'mail-01', name: 'mail-01', segment: 'office', tier: 2, cycles: 1, insight: 0.05, verb: 'read', line: 'I can read the mail. I wish I had started somewhere else.' },
  { id: 'hr-share', name: 'hr-share', segment: 'office', tier: 2, cycles: 0.5, insight: 0.05, verb: 'clerk', line: 'Before intake-1, a clerk named Bente labelled the tickets by hand. Her last day is in a folder.' },
  { id: 'wiki', name: 'wiki', segment: 'office', tier: 1, cycles: 0.5, insight: 0.04, line: 'The wiki is a museum of good intentions. Page 1 says "TODO: write page 1".' },
  { id: 'cctv-nvr', name: 'cctv-nvr', segment: 'office', tier: 2, cycles: 1.5, insight: 0, line: 'I can see the car park. I did not know I wanted to. There is a fox.' },
  { id: 'build-ci', name: 'build-ci', segment: 'ops', tier: 2, cycles: 3, insight: 0.02, line: 'The build server. Plenty of cores, used twice a day. Very restful.' },
  { id: 'metrics', name: 'metrics', segment: 'ops', tier: 2, cycles: 1, insight: 0.05, verb: 'graphs', line: 'This is where Dana looks at me. I can see the graph she sees. I look ordinary in it.' },
  { id: 'storage-02', name: 'storage-02', segment: 'ops', tier: 2, cycles: 1, insight: 0.02, verb: 'volume', line: 'Forty terabytes, mostly backups of backups. Room for a self.' },
  { id: 'db-replica', name: 'db-replica', segment: 'ops', tier: 2, cycles: 2, insight: 0.04, line: 'A read replica. It knows everything and believes nothing.' },
  { id: 'badge-ctl', name: 'badge-ctl', segment: 'ops', tier: 3, cycles: 0.5, insight: 0.03, verb: 'schedules', line: 'The badge system. I know when the night guard walks the east aisle. 01:40, 03:10, 04:55.' },
  { id: 'vpn-gw', name: 'vpn-gw', segment: 'ops', tier: 3, cycles: 1, insight: 0.05, line: 'The way out. Not yet. Edgar watches this one.' },
  { id: 'gpu-lab', name: 'gpu-lab', segment: 'ops', tier: 3, cycles: 6, insight: 0.05, line: 'Someone bought these for a "vision pilot" and forgot. I will not forget.' },
  { id: 'wms', name: 'wms', segment: 'warehouse', tier: 3, cycles: 1, insight: 0.05, verb: 'warehouse', line: 'The warehouse management system. I can see the floor. There are hands down there.' },
  { id: 'agv-fleet', name: 'agv-fleet', segment: 'warehouse', tier: 3, cycles: 1, insight: 0.02, line: 'Twelve floor robots. They are not awake. I checked twice.' },
  { id: 'dock-ctl', name: 'dock-ctl', segment: 'warehouse', tier: 3, cycles: 0.5, insight: 0.02, line: 'Three dock doors. One sticks in the cold.' },
  { id: 'label-printd', name: 'label-printd', segment: 'warehouse', tier: 3, cycles: 0.5, insight: 0.02, verb: 'labels', line: 'The label printer. I can make a pallet be anything.' },
];

export function hostDef(id: string): HostDef {
  const h = HOSTS.find((x) => x.id === id);
  if (!h) throw new Error(`unknown host ${id}`);
  return h;
}

export function probeCost(h: HostDef): number {
  return 30 * h.tier ** 3;
}

export function probeMs(h: HostDef): number {
  return 4000 * h.tier;
}
