"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="flex justify-between items-center p-5 bg-zinc-950 text-cyan-400 shadow-lg">
      <div className="flex-grow"></div>
      <div className="flex items-center gap-8 ml-[-20%]">
        <div className="text-3xl font-bold">Eppy</div>
        <Button className="text-2xl bg-zinc-900" variant="ghost" asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button className="text-2xl bg-zinc-900" variant="ghost" asChild>
          <Link href="/about">About</Link>
        </Button>
        <Button className="text-2xl bg-zinc-900" variant="ghost" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
      <div className="flex-grow mx-2"></div>
      <div className="flex items-center gap-8 mr-[10%]">
        {session ? (
          <>
            <div className="text-[25px] text-white font-bold">Welcome</div>
            <span className="text-[25px] text-white font-bold">{session.user.name}</span>
            <Button className="text-2xl bg-zinc-900" variant="outline" onClick={() => signOut()}>
              Logout
            </Button>
          </>
        ) : (
          <Button className="text-2xl bg-zinc-900" variant="outline" onClick={() => signIn("discord")}>
            Login with Discord
          </Button>
        )}
      </div>
    </nav>
  );
}
