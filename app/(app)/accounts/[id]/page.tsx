import AccountDetailContent from "./components/AccountDetailContent";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AccountDetailContent id={id} />;
}
