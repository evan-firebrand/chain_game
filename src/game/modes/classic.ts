import type { ModeBehavior } from "./types";

export const classic: ModeBehavior = {
  id: "classic",
  label: "Classic",
  initState: () => ({ kind: "classic" }),
};
