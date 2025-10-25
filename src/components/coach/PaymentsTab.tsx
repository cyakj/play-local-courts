import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const PaymentsTab = () => {
  const [loading, setLoading] = useState(false);
  const [stripeAccount, setStripeAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load Stripe account
      const { data: accountData } = await supabase
        .from("stripe_accounts")
        .select("*")
        .eq("coach_id", user.id)
        .single();

      setStripeAccount(accountData);

      // Load transactions
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select(`
          *,
          player:profiles!transactions_player_id_fkey(full_name),
          lesson_request:lesson_requests(lesson_type, sport)
        `)
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });

      setTransactions(transactionsData || []);
    } catch (error) {
      console.error("Error loading payment data:", error);
    }
  };

  const handleConnectStripe = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("create-connect-account");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Opening Stripe Connect setup...");
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      toast.error("Failed to connect Stripe account");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke(
        "create-connect-dashboard-link"
      );

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening dashboard:", error);
      toast.error("Failed to open Stripe dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect Account</CardTitle>
          <CardDescription>
            Connect your Stripe account to receive payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stripeAccount ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                You need to connect a Stripe account to receive lesson payments.
              </p>
              <Button
                onClick={handleConnectStripe}
                disabled={loading}
                className="w-fit"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Stripe Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">Account Status</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={stripeAccount.charges_enabled ? "default" : "secondary"}>
                      {stripeAccount.charges_enabled ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Charges Enabled</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Charges Disabled</>
                      )}
                    </Badge>
                    <Badge variant={stripeAccount.payouts_enabled ? "default" : "secondary"}>
                      {stripeAccount.payouts_enabled ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Payouts Enabled</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Payouts Disabled</>
                      )}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={handleOpenDashboard}
                  disabled={loading}
                  variant="outline"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Stripe Dashboard
                </Button>
              </div>
              {!stripeAccount.details_submitted && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Complete your Stripe account setup to start receiving payments.
                  </p>
                  <Button
                    onClick={handleConnectStripe}
                    disabled={loading}
                    variant="outline"
                    className="mt-2"
                  >
                    Complete Setup
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>View your lesson payment transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Lesson Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{transaction.player?.full_name || "Unknown"}</TableCell>
                    <TableCell>
                      {transaction.lesson_request?.lesson_type || "N/A"}
                    </TableCell>
                    <TableCell>
                      ${(transaction.amount / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.status === "completed"
                            ? "default"
                            : transaction.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
