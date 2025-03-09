import { Button } from "@/components/ui/button";

export default function Login() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-3xl font-bold">Logowanie</h1>
      <Button className="mt-4" variant="default">
        Zaloguj przez Discord
      </Button>
    </main>
  );
}
