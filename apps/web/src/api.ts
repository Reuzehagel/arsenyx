const BASE = "http://localhost:8787";

export type Build = {
  id: string;
  name: string;
  frame: string;
  votes: number;
  author: string;
};

export type BuildDetail = Build & {
  description: string;
  mods: string[];
};

export async function fetchBuilds(): Promise<Build[]> {
  const r = await fetch(`${BASE}/builds`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

export async function fetchBuild(id: string): Promise<BuildDetail> {
  const r = await fetch(`${BASE}/builds/${id}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

export async function searchBuilds(q: string): Promise<Build[]> {
  const r = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}
