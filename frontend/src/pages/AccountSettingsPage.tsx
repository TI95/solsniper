import WalletGenerator from "@/components/CreateNewWalletBtn";
import BotControl from "@/components/BotControl";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";

const AccountSettingsPage = () => {
    return (
        <MaxWidthWrapper>
            <div>
                <h1 className="text-xl font-bold">Настройки аккаунта</h1>
                <WalletGenerator />
                <BotControl />
            </div>
        </MaxWidthWrapper>
    );
};

export default AccountSettingsPage;
