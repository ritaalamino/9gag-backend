import { getRepository } from 'typeorm';
import { sign, Secret, SignOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import ThirdPartyCreateUserService from './ThirdPartyCreateUserService';
import ServiceError from '../../util/ServiceError';
import authConfig from '../../config/auth';
import User from '../../models/User';

interface Request {
  email: string;
  name: string;
  picture?: string;
}

class ThirdPartyAuthenticateUserService {
  public async execute({ email, name, picture }: Request): Promise<any> {
    const usersRepository = getRepository(User);
    let user = await usersRepository.findOne({
      where: { email },
    });

    if (!user) {
      const thirdPartyCreateService = new ThirdPartyCreateUserService();
      user = await thirdPartyCreateService.execute({ name, email, picture });
    }
    try {
      const payload = {
        user: {
          id: user.id,
          fullname: user.fullname,
          email: user.email,
        },
      };
      const token = await promisify<any, Secret, SignOptions>(sign)(
        payload,
        authConfig.secret,
        {
          expiresIn: 3600,
        },
      );
      return { token, payload };
    } catch (err) {
      throw new ServiceError(err, 500);
    }
  }
}

export default ThirdPartyAuthenticateUserService;
