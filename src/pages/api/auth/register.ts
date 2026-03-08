import type { APIRoute } from "astro";
import { lucia } from "../../../lib/auth";
import { generateId } from "lucia";
import { Argon2id } from "oslo/password";
import db from "../../../db/client";

export const POST: APIRoute = async (context) => {
    const formData = await context.request.formData();
    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || email.length < 3 || !email.includes("@")) {
        return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
    }

    if (typeof password !== "string" || password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400 });
    }

    const hashedPassword = await new Argon2id().hash(password);
    const userId = generateId(15);
    const apiKey = "sk_live_" + generateId(32);

    try {
        const stmt = db.prepare("INSERT INTO user (id, email, hashed_password, api_key) VALUES (?, ?, ?, ?)");
        stmt.run(userId, email, hashedPassword, apiKey);

        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

        return context.redirect("/dashboard");
    } catch (e: any) {
        if (e.message?.includes("UNIQUE constraint failed")) {
            return new Response(JSON.stringify({ error: "Email already in use" }), { status: 400 });
        }
        return new Response(JSON.stringify({ error: "An unknown error occurred" }), { status: 500 });
    }
};
