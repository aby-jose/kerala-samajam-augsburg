import { AuthProvider } from "@/components/providers/auth-provider";
import { getConfig } from "@/lib/config-utils";
import { ConfigProvider } from "@/components/providers/config-provider";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getConfig();

  return (
    <AuthProvider basePath="/api/admin/auth">
      <ConfigProvider initialConfig={config}>
        {children}
      </ConfigProvider>
    </AuthProvider>
  );
}
