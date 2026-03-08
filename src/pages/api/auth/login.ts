import type { APIRoute } from "astro";
import { lucia } from "../../../lib/auth";
import { Argon2id } from "oslo/password";
import db from "../../../db/client";

export const POST: APIRoute = async (context) => {
    const formData = await context.request.formData();
    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || typeof password !== "string") {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 400 });
    }

    try {
        const stmt = db.prepare("SELECT * FROM user WHERE email = ?");
        const existingUser = stmt.get(email) as { id: string, hashed_password: string } | undefined;

        if (!existingUser) {
            return new Response(JSON.stringify({ error: "Incorrect email or password" }), { status: 400 });
        }

        const validPassword = await new Argon2id().verify(existingUser.hashed_password, password);
        if (!validPassword) {
            return new Response(JSON.stringify({ error: "Incorrect email or password" }), { status: 400 });
        }

        const session = await lucia.createSession(existingUser.id, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

        return context.redirect("/dashboard");
    } catch (e: any) {
        return new Response(JSON.stringify({ error: "An unknown error occurred" }), { status: 500 });
    }
};
