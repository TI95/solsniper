import WalletGenerator from "@/components/CreateNewWalletBtn";
import BotControl from "@/components/BotControl";
import FilterSettings from "@/components/FilterSettings";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";

const AccountSettingsPage = () => {
    return (
        <MaxWidthWrapper>
            <div>
                <h1 className="text-xl font-bold">Настройки аккаунта</h1>
                <WalletGenerator />
                <FilterSettings />
                <BotControl />
            </div>
        </MaxWidthWrapper>
    );
};

export default AccountSettingsPage;
