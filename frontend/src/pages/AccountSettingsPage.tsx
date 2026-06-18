import { useEffect, useState } from "react";
import WalletPanel from "@/components/WalletPanel";
import WithdrawForm from "@/components/WithdrawForm";
import ExportKeyDialog from "@/components/ExportKeyDialog";
import BotControl from "@/components/BotControl";
import FilterSettings from "@/components/FilterSettings";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { getFilter } from "@/api/filter-api";

const AccountSettingsPage = () => {
    // Single source of truth for "is a filter configured?", shared by
    // FilterSettings (writes it on save) and BotControl (gates Start on it).
    const [hasFilter, setHasFilter] = useState(false);
    // Withdraw/export only make sense when a wallet exists; WalletPanel reports it up.
    const [walletPubKey, setWalletPubKey] = useState<string | null>(null);

    useEffect(() => {
        getFilter()
            .then((f) => setHasFilter(f !== null))
            .catch(() => setHasFilter(false));
    }, []);

    return (
        <MaxWidthWrapper>
            <div>
                <h1 className="text-xl font-bold">Настройки аккаунта</h1>
                <WalletPanel onWalletChange={setWalletPubKey} />
                {walletPubKey && (
                    <>
                        <WithdrawForm />
                        <ExportKeyDialog />
                    </>
                )}
                <FilterSettings onSaved={() => setHasFilter(true)} />
                <BotControl hasFilter={hasFilter} />
            </div>
        </MaxWidthWrapper>
    );
};

export default AccountSettingsPage;
