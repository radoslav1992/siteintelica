import { Lucia } from "lucia";
import { BetterSqlite3Adapter } from "@lucia-auth/adapter-sqlite";
import db from "../db/client";

const adapter = new BetterSqlite3Adapter(db, {
    user: "user",
    session: "session"
});

export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            secure: import.meta.env.PROD
        }
    },
    getUserAttributes: (attributes) => {
        return {
            email: attributes.email,
            apiKey: attributes.api_key
        };
    }
});

declare module "lucia" {
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: DatabaseUserAttributes;
    }
}

interface DatabaseUserAttributes {
    email: string;
    api_key: string | null;
}
