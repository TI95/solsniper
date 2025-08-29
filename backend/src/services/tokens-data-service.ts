import { BoughtTokensData, TokensDataModel } from "../models/tokens-data-model";

 
    
class TokensDataService {

   async saveBoughtToken(userId: string, data: Omit<BoughtTokensData, 'user'>) {
        return TokensDataModel.create({ ...data, user: userId});
    }

    async getAllBoughtTokens(userId: string) {
        return TokensDataModel.find({ user: userId });
    }

}

export default new TokensDataService();