import { Router } from 'express';
import { getRepository } from 'typeorm';
import { trim } from '../util/Object';
import User from '../models/User';
import ensureAuthenticated from '../middleware/ensureAuthenticated';
import CreateUserService from '../services/user/CreateUserService';
import CreatePasswordResetService from '../services/user/CreatePasswordResetService';
import UserVerficationService from '../services/user/UserVerficationService';
import ThirdPartyCreateUserService from '../services/auth/ThirdPartyCreateUserService';
import ResetUserPasswordService from '../services/user/ResetUserPasswordService';

const router = Router();

router.route('/').get(ensureAuthenticated, async (req, res) => {
  try {
    const userRepository = getRepository(User);
    const users = await userRepository.find();

    return res.status(201).json(
      users.map(user =>
        trim({
          ...user,
          password: undefined, // #remove sensitive info
        }),
      ),
    );
  } catch (err) {
    return res.status(500).json({
      message: err,
    });
  }
});

router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userRepository = getRepository(User);
    const user = await userRepository.findOne({
      relations: ['avatar'],
      where: { username },
    });
    if (user) {
      delete user.password;
      delete user.verificationCode;
      return res.status(200).json({
        ...user,
      });
    }
    return res.status(400).json({
      message: 'Usuario não foi encontrado',
    });
  } catch (err) {
    return res.status(500).json({
      message: err,
    });
  }
});

router.post('/', async (req, res) => {
  const {
    password,
    email,
    fullname,
    thirdPartyToken,
    avatar,
    username,
  } = req.body;
  try {
    let user;
    if (!thirdPartyToken) {
      const createUserService = new CreateUserService();
      user = await createUserService.execute({
        fullname,
        email,
        password,
        fileId: avatar,
        username,
      });
    } else {
      const createThirdPartyUserService = new ThirdPartyCreateUserService();

      user = await createThirdPartyUserService.execute({
        thirdPartyToken,
        // fileId: avatar,
      });
    }

    return res.status(201).json(
      trim({
        ...user,
        password: undefined, // #remove sensitive info
        verificationCode: undefined,
      }),
    );
  } catch (err) {
    return res.status(err.status).json({
      message: err.message,
    });
  }
});

router.get('/verification/:code', async (req, res) => {
  const { code } = req.params;
  const verificationService = new UserVerficationService();
  try {
    const user = await verificationService.execute({
      code,
    });
    return res.status(201).json(
      trim({
        ...user,
        password: undefined, // #remove sensitive info
      }),
    );
  } catch (err) {
    return res.status(err.status).json({
      message: err.message,
    });
  }
});

router.post('/password/reset', async (req, res) => {
  const { email } = req.body;
  const createPasswordResetService = new CreatePasswordResetService();
  try {
    await createPasswordResetService.execute({
      email,
    });
    return res.status(200).json({
      message:
        'Um e-mail foi enviado a você com instruções para redefinir sua senha.',
    });
  } catch (err) {
    return res.status(err.status).json({
      message: err.message,
    });
  }
});

router.put('/password/reset', async (req, res) => {
  const { code, password, passwordConfirm } = req.body;
  const resetUserPasswordService = new ResetUserPasswordService();
  try {
    await resetUserPasswordService.execute({
      code,
      password,
      passwordConfirm,
    });
    return res.status(200).json({
      message:
        'Sua senha foi redefinida, faça o login com a nova senha e tenha um bom dia.',
    });
  } catch (err) {
    return res.status(err.status).json({
      message: err.message,
    });
  }
});

export default router;
