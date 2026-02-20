import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(200)
    async login(@Body() loginDto: LoginDto) {
        this.logger.log(`Tentativa de login: ${loginDto.username}`);

        const user = await this.authService.validateUser(
            loginDto.username,
            loginDto.password,
        );

        return this.authService.login(user);
    }
}
