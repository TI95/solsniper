import { useEffect, useState } from "react";
import WalletGenerator from "@/components/CreateNewWalletBtn";
import BotControl from "@/components/BotControl";
import FilterSettings from "@/components/FilterSettings";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { getFilter } from "@/api/filter-api";

const AccountSettingsPage = () => {
    // Single source of truth for "is a filter configured?", shared by
    // FilterSettings (writes it on save) and BotControl (gates Start on it).
    const [hasFilter, setHasFilter] = useState(false);

    useEffect(() => {
        getFilter()
            .then((f) => setHasFilter(f !== null))
            .catch(() => setHasFilter(false));
    }, []);

    return (
        <MaxWidthWrapper>
            <div>
                <h1 className="text-xl font-bold">Настройки аккаунта</h1>
                <WalletGenerator />
                <FilterSettings onSaved={() => setHasFilter(true)} />
                <BotControl hasFilter={hasFilter} />
            </div>
        </MaxWidthWrapper>
    );
};

export default AccountSettingsPage;
