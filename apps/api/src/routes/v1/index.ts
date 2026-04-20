import { Hono } from "hono"

import { v1Builds } from "./builds"
import { v1Imports } from "./imports"

export const v1 = new Hono()

v1.route("/builds", v1Builds)
v1.route("/imports", v1Imports)
