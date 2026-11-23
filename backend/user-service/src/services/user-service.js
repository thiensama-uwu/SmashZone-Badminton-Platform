const { AppError } = require("../../../shared/lib/errors");
const { hashPassword } = require("../../../shared/utils/password");

class UserService {
  constructor({ repository }) {
    this.repository = repository;
  }

  async adminCreateUser(input) {
    const existing = await this.repository.findByEmail(input.email);
    if (existing) throw new AppError(409, "EMAIL_TAKEN", "Email already exists");

    const passwordHash = await hashPassword(input.password);
    try {
      return await this.repository.createUser({
        email: input.email,
        passwordHash,
        roleCodes: input.roles,
        fullName: input.fullName,
        phone: input.phone,
        gender: input.gender,
        birthDate: input.birthDate,
      });
    } catch (err) {
      if (err?.code === "P2002" && err?.meta?.target?.includes("phone")) {
        throw new AppError(409, "PHONE_TAKEN", "Số điện thoại này đã được sử dụng bởi tài khoản khác");
      }
      throw err;
    }
  }

  async bootstrapProfile(input) {
    return this.repository.bootstrapProfile(input);
  }

  async getMe(userId) {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    return profile;
  }

  async updateMe(userId, input) {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    if (input.version && Number(input.version) !== profile.version) {
      throw new AppError(409, "VERSION_CONFLICT", "Profile was updated by another request");
    }

    try {
      return await this.repository.updateProfile(userId, {
        fullName: input.fullName ?? profile.fullName,
        phone: input.phone ?? profile.phone,
        gender: input.gender ?? profile.gender,
        birthDate: input.birthDate ?? profile.birthDate,
        avatarUrl: input.avatarUrl ?? profile.avatarUrl,
      });
    } catch (err) {
      if (err?.code === "P2002" && err?.meta?.target?.includes("phone")) {
        throw new AppError(409, "PHONE_TAKEN", "Số điện thoại này đã được sử dụng bởi tài khoản khác");
      }
      throw err;
    }
  }
  async listUsers(query) {
    return this.repository.listUsers(query);
  }

  async getUser(userId) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    return user;
  }

  async updateUser(userId, input) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");

    if (input.roles) {
      await this.repository.updateUserRoles(userId, input.roles);
    }
    if (input.fullName || input.phone || input.gender || input.birthDate !== undefined) {
      const profile = await this.repository.findByUserId(userId);
      if (profile) {
        try {
          await this.repository.updateProfile(userId, {
            fullName: input.fullName ?? profile.fullName,
            phone: input.phone ?? profile.phone,
            gender: input.gender ?? profile.gender,
            birthDate: input.birthDate ?? profile.birthDate,
          });
        } catch (err) {
          if (err?.code === "P2002" && err?.meta?.target?.includes("phone")) {
            throw new AppError(409, "PHONE_TAKEN", "Số điện thoại này đã được sử dụng bởi tài khoản khác");
          }
          throw err;
        }
      }
    }
    return this.repository.findUserById(userId);
  }

  async hardDeleteUser(userId) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    await this.repository.hardDeleteUser(userId);
  }
}

module.exports = {
  UserService,
};
