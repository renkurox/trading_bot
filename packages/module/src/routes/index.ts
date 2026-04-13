import Elysia from "elysia";

export const home = new Elysia().get("", { hello: "world" });
