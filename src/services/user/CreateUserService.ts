/* eslint-disable no-await-in-loop */
import { getRepository, getManager } from 'typeorm';
import { hash } from 'bcrypt';

import SendUserEmailVerification from '../auth/SendUserEmailVerification';
import ServiceError from '../../util/ServiceError';
import { validateUsername } from '../../util/String';
import User from '../../models/User';
import auth from '../../config/auth';
import File from '../../models/File';

interface Request {
  fullname: string;
  age?: number;
  email: string;
  password: string;
  fileId?: string;
  username: string;
}

class CreateUserService {
  public async execute({
    fullname,
    age,
    email,
    password,
    fileId,
    username,
  }: Request): Promise<User> {
    const userRepository = getRepository(User);
    const fileRepository = getRepository(File);
    const verificationService = new SendUserEmailVerification();

    const userExits = await userRepository.findOne({
      where: { email },
    });
    if (userExits) {
      throw new ServiceError('E-mail já registrado.', 400);
    }
    const usernameExists = await userRepository.findOne({
      where: { username },
    });
    if (usernameExists) {
      throw new ServiceError('Nome de usuário já registrado.', 400);
    }
    const invalidUsername = validateUsername(username);
    if (invalidUsername) {
      throw new ServiceError(invalidUsername, 400);
    }

    let avatar = null;
    if (fileId) {
      avatar = await fileRepository.findOne({ where: { id: fileId } });
      if (!avatar) {
        throw new ServiceError('ID de arquivo inválido.', 400);
      }
    }

    const createdAt = new Date();
    const updatedAt = new Date();

    const hashedPassword = await hash(password, auth.crypt.rounds);

    let verificationCode: string;

    do {
      verificationCode = Math.random().toString(36).substring(6);
      const userVerificatioExists = await userRepository.findOne({
        where: { verificationCode },
      });
      if (!userVerificatioExists) {
        break;
      }
    } while (true);

    try {
      const userData = userRepository.create({
        fullname,
        age,
        email,
        password: hashedPassword,
        createdAt,
        updatedAt,
        verificationCode,
        avatar,
        username,
        about: 'Minha coleção engraçada',
      });
      return (await getManager().transaction(
        async transactionalEntityManager => {
          const user = await transactionalEntityManager.save(userData);
          try {
            const sended = await verificationService.execute({ user });
            if (sended) {
              return user;
            }
          } catch (err) {
            transactionalEntityManager.release();
            throw err;
          }
        },
      )) as User;
    } catch (err) {
      throw new ServiceError(`Erro no usuário criado: ${err}`);
    }
  }
}

export default CreateUserService;
