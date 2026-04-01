import { Chat } from "@/components/chat";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col bg-zinc-50">
      <div className="flex h-[100dvh] w-full flex-col px-0 sm:px-0">
        <Chat />
      </div>
    </main>
  );
}
