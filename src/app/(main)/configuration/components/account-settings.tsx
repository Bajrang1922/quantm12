"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccount } from "@/context/account-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Info, Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function ManageFollowerDialog({ account }: { account: any }) {
    const { toast } = useToast();
    const [clientId, setClientId] = useState(account.clientId || '');
    const [apiKey, setApiKey] = useState(account.apiKey || '');
    const [consentGiven, setConsentGiven] = useState(account.consentGiven || false);
    const [brokerSessionId, setBrokerSessionId] = useState(account.brokerSessionId || '');
    const [open, setOpen] = useState(false);

    const handleSave = async () => {
        if (!clientId || !apiKey) {
            toast({
                variant: 'destructive',
                title: 'Invalid Input',
                description: 'Client ID and API Key are required.',
            });
            return;
        }

        try {
            // Call API to update credentials
            const response = await fetch('/api/followers/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    followerId: account.id,
                    clientId,
                    apiKey,
                    brokerSessionId: brokerSessionId || undefined,
                    accessToken: 'api_auth',
                }),
            });

            const result = await response.json();
            if (!result.ok) {
                throw new Error(result.message);
            }

            // Update risk config consent
            const consentResponse = await fetch('/api/followers/consent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    followerId: account.id,
                    consentToken: consentGiven ? `consent-${account.id}-${Date.now()}` : null,
                }),
            });

            const consentResult = await consentResponse.json();
            if (!consentResult.ok) {
                throw new Error(consentResult.message);
            }

            toast({
                title: 'Success',
                description: 'Credentials updated successfully!',
            });
            setOpen(false);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to update credentials',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">Manage</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Manage {account.name}</DialogTitle>
                    <DialogDescription>
                        Update Client ID and API Key for this account.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="manage-client-id">Client ID / API ID <span className="text-red-500">*</span></Label>
                        <Input 
                            id="manage-client-id" 
                            value={clientId} 
                            onChange={(e) => setClientId(e.target.value)} 
                            placeholder="Client ID from broker" 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="manage-api-key">API Key / Secret <span className="text-red-500">*</span></Label>
                        <Input 
                            id="manage-api-key" 
                            value={apiKey} 
                            onChange={(e) => setApiKey(e.target.value)} 
                            placeholder="API Key / Secret from broker" 
                            type="password"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="manage-broker-session-id">Broker Session ID (Optional)</Label>
                        <Input 
                            id="manage-broker-session-id" 
                            value={brokerSessionId} 
                            onChange={(e) => setBrokerSessionId(e.target.value)} 
                            placeholder="Broker session ID if required"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>User Consent <span className="text-red-500">*</span></Label>
                        <div className="flex items-center gap-2">
                            <input 
                                id="manage-consent" 
                                type="checkbox" 
                                checked={consentGiven} 
                                onChange={(e) => setConsentGiven(e.target.checked)} 
                            />
                            <Label htmlFor="manage-consent" className="text-sm">I consent to allow trade replication to this account.</Label>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function AddFollowerDialog() {
    const { addAccount } = useAccount();
    const { toast } = useToast();
    const [accountType, setAccountType] = useState('Follower');
    const [accountId, setAccountId] = useState('');
    const [accountName, setAccountName] = useState('');
    const [telegramId, setTelegramId] = useState('');
    const [clientId, setClientId] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [lotMultiplier, setLotMultiplier] = useState('1');
    const [maxOrderQuantity, setMaxOrderQuantity] = useState('1000');
    const [consentGiven, setConsentGiven] = useState(false);
    
    const [open, setOpen] = useState(false);
    const [newCreds, setNewCreds] = useState<{username: string, password: string} | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddFollower = async () => {
        if (!accountId || !accountName || !clientId || !apiKey) {
            toast({
                variant: 'destructive',
                title: 'Invalid Input',
                description: 'Please fill out all required fields: Account ID, Account Name, Client ID, and API Key.',
            });
            return;
        }

        if (!consentGiven) {
            toast({
                variant: 'destructive',
                title: 'Consent Required',
                description: 'You must provide consent to allow trade replication.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
          // Persist credentials to server (DB)
          // Using only Client ID + API Key for copy trading
          const res = await fetch('/api/followers/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              followerId: accountId,
              clientId,
              apiKey,
              accessToken: 'api_key_auth', // Flag to indicate API Key method
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.message || 'Failed saving credentials');

          // Update risk config (lot multiplier, max quantity)
          const configRes = await fetch('/api/followers/update-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              followerId: accountId,
              lotMultiplier: parseFloat(lotMultiplier) || 1,
              maxOrderQuantity: parseInt(maxOrderQuantity) || 1000,
            }),
          });

          const configData = await configRes.json();
          if (!configRes.ok || !configData.ok) throw new Error(configData.message || 'Failed saving configuration');

          // Add to local UI context
          const result = addAccount({ 
            id: accountId, 
            name: accountName, 
            telegramId: telegramId || undefined, 
            initialBalance: 0,
            lotMultiplier: parseFloat(lotMultiplier) || 1,
            clientId: clientId,
            apiKey: apiKey,
            consentGiven: consentGiven,
          }, accountType as 'Follower' | 'Master');

          if (result.success && result.username && result.password) {
            setNewCreds({ username: result.username, password: result.password });
          } else if (result.success) {
            setNewCreds(null);
            setOpen(false);
          } else {
            throw new Error(result.message || 'Failed adding account locally');
          }

          // Clear form
          setAccountId('');
          setAccountName('');
          setTelegramId('');
          setClientId('');
          setApiKey('');
          setLotMultiplier('1');
          setMaxOrderQuantity('1000');
        } catch (err: any) {
          toast({ variant: 'destructive', title: 'Error', description: err.message || String(err) });
        } finally {
          setIsSubmitting(false);
        }
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Credentials copied to clipboard." });
    }

    const resetAndClose = () => {
        setNewCreds(null);
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
             <Card className="border-dashed flex items-center justify-center hover:border-primary transition-colors cursor-pointer min-h-[260px]">
                <div className="text-center text-muted-foreground">
                    <PlusCircle className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium text-foreground">Add New Account</h3>
                    <p className="mt-1 text-sm">Create a new follower profile</p>
                </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => {
              if(newCreds) e.preventDefault();
          }}>
            {!newCreds ? (
                <>
                    <DialogHeader>
                      <DialogTitle>Add New Account</DialogTitle>
                      <DialogDescription>
                        Fill in the details to add a new master or follower account.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                        <div className="space-y-2">
                        <Label htmlFor="account-type">Account Type</Label>
                        <Select value={accountType} onValueChange={setAccountType}>
                          <SelectTrigger id="account-type">
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Follower">Follower</SelectItem>
                            <SelectItem value="Master">Master</SelectItem>
                          </SelectContent>
                        </Select>
                        </div>
                      <div className="space-y-2">
                        <Label htmlFor="account-id">Account ID</Label>
                        <Input id="account-id" value={accountId} onChange={(e) => setAccountId(e.target.value.toUpperCase())} placeholder="e.g., ZERODHA-123" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account-name">Account Name</Label>
                        <Input id="account-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g., My Trading Account" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telegram-id">Telegram ID (Optional)</Label>
                        <Input id="telegram-id" value={telegramId} onChange={(e) => setTelegramId(e.target.value)} placeholder="@username" />
                      </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-id">Client ID <span className="text-red-500">*</span></Label>
                          <Input id="client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID from broker" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="api-key">API Key <span className="text-red-500">*</span></Label>
                          <Input id="api-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key from broker" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor="lot-multiplier">Lot Multiplier</Label>
                            <Input 
                              id="lot-multiplier" 
                              value={lotMultiplier} 
                              onChange={(e) => setLotMultiplier(e.target.value)} 
                              placeholder="1" 
                              type="number"
                              step="0.1"
                              min="0.1"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="max-qty">Max Qty per Order</Label>
                            <Input 
                              id="max-qty" 
                              value={maxOrderQuantity} 
                              onChange={(e) => setMaxOrderQuantity(e.target.value)} 
                              placeholder="1000" 
                              type="number"
                              min="1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>User Consent (VERY IMPORTANT)</Label>
                          <div className="flex items-center gap-2">
                            <input id="consent" type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} />
                            <Label htmlFor="consent" className="text-sm">I consent to allow trade replication to this account.</Label>
                          </div>
                        </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="ghost" disabled={isSubmitting}>Cancel</Button>
                      </DialogClose>
                      <Button onClick={handleAddFollower} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Account'}</Button>
                    </DialogFooter>
                </>
            ) : (
                <>
                    <DialogHeader>
                      <DialogTitle>Account Created Successfully!</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <Info className="h-5 w-5 text-yellow-400" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-yellow-700">
                                    Please save these credentials securely. You will not be able to see them again.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Username</Label>
                            <div className="flex items-center gap-2">
                                <Input value={newCreds.username} readOnly />
                                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newCreds.username)}><Copy className="h-4 w-4"/></Button>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Password</Label>
                            <div className="flex items-center gap-2">
                                <Input value={newCreds.password} readOnly />
                                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newCreds.password)}><Copy className="h-4 w-4"/></Button>
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button onClick={resetAndClose}>I have saved the credentials</Button>
                    </DialogFooter>
                </>
            )}
          </DialogContent>
        </Dialog>
    )
}

export function AccountSettings() {
  const { followerAccounts, masterAccounts, removeFollower, removeMaster } = useAccount() as any;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Follower Accounts</h3>
        <div className="grid gap-6 md:grid-cols-2">
          {masterAccounts?.map((account: any) => (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle>{account.name}</CardTitle>
                <CardDescription>
                  {account.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Username:</span>
                      <span className="font-mono">{account.username}</span>
                    </div>
                     <div className="flex justify-between">
                      <span className="text-muted-foreground">Initial Balance:</span>
                      <span>₹{account.initialBalance.toLocaleString()}</span>
                    </div>
                 </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div>
                  <Button onClick={() => { window.location.href = `/api/alice/oauth/start?accountId=${encodeURIComponent(account.id)}`; }}>Connect</Button>
                </div>
                <div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Remove</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the account
                        for {account.name} and remove all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeMaster(account.id)}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
          {followerAccounts.map((account: any) => (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle>{account.name}</CardTitle>
                <CardDescription>
                  {account.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Username:</span>
                      <span className="font-mono">{account.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client ID:</span>
                      <span className="font-mono">{account.clientId || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">API Key:</span>
                      <span className="font-mono">{account.apiKey ? '••••••••' : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Consent:</span>
                      <span>{account.consentGiven ? 'Given' : 'Not Given'}</span>
                    </div>
                 </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <ManageFollowerDialog account={account} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Remove</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the account
                        for {account.name} and remove all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeFollower(account.id)}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
          <AddFollowerDialog />
        </div>
      </div>
    </div>
  );
}
