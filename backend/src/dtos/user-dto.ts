import { User } from '../models/user-model';

export default class UserDto {
    email: string;
    id: string;
    isActivated: boolean;

    constructor(model: User) {
        this.email = model.email;
        this.id = model._id.toString();
        this.isActivated = model.isActivated ?? false;
    }

    
}

