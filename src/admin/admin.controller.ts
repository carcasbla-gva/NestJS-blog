import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { copyFile } from 'fs/promises';
import { join } from 'path';
import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { AdminGuard } from '../common/guards';
import { CsrfService } from '../common/csrf.service';
import {
  GALLERY_IMAGE_DIR,
  PORTFOLIO_IMAGE_DIR,
} from '../common/paths';
import {
  imageStorage,
  isAllowedImageMime,
  removeUploadedFile,
} from '../common/upload';
import { formString, parseInteger } from '../common/view-helpers';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get('categories')
  async categoriesForm(@Res() res: Response): Promise<void> {
    const categories = await this.adminService.listCategories();
    res.render('admin/categories', {
      categories,
      values: {},
      errors: {},
    });
  }

  @Post('categories')
  async createCategory(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const values = { name: formString(req.body.name) };
    const errors: Record<string, string> = {};

    if (!values.name) {
      errors.name = 'El nombre es obligatorio';
    }

    if (Object.keys(errors).length > 0) {
      const categories = await this.adminService.listCategories();
      res.status(200).render('admin/categories', { categories, values, errors });
      return;
    }

    await this.adminService.createCategory(values.name);
    req.session.flash = {
      type: 'success',
      message: 'Categoría creada correctamente.',
    };
    res.redirect('/admin/categories');
  }

  @Get('images')
  async imagesForm(@Res() res: Response): Promise<void> {
    await this.renderImages(res);
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageStorage(GALLERY_IMAGE_DIR),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createImage(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<void> {
    try {
      this.csrfService.assertValid(req);
    } catch (error) {
      await removeUploadedFile(file);
      throw error;
    }

    const values = {
      numLikes: formString(req.body.numLikes),
      numViews: formString(req.body.numViews),
      numDownloads: formString(req.body.numDownloads),
      category: formString(req.body.category),
    };

    const errors: Record<string, string> = {};
    if (!file) {
      errors.file = 'La imagen es obligatoria';
    } else if (!isAllowedImageMime(file.mimetype)) {
      errors.file = 'Por favor sube una imagen válida (JPEG o PNG)';
    }

    const numLikes = parseInteger(values.numLikes, 0);
    const numViews = parseInteger(values.numViews, 0);
    const numDownloads = parseInteger(values.numDownloads, 0);

    if (Number.isNaN(numLikes)) {
      errors.numLikes = 'Introduce un número válido';
    }
    if (Number.isNaN(numViews)) {
      errors.numViews = 'Introduce un número válido';
    }
    if (Number.isNaN(numDownloads)) {
      errors.numDownloads = 'Introduce un número válido';
    }

    const categoryId = parseInteger(values.category, 0);
    const category =
      categoryId > 0
        ? await this.adminService.findCategoryById(categoryId)
        : null;
    if (!category) {
      errors.category = 'Selecciona una categoría';
    }

    if (Object.keys(errors).length > 0) {
      await removeUploadedFile(file);
      await this.renderImages(res, values, errors);
      return;
    }

    try {
      await copyFile(
        file.path,
        join(PORTFOLIO_IMAGE_DIR, file.filename),
      );
    } catch {
      await removeUploadedFile(file);
      await this.renderImages(res, values, {
        file: 'No se pudo copiar la imagen a la carpeta portfolio',
      });
      return;
    }

    await this.adminService.createImage({
      file: file.filename,
      numLikes,
      numViews,
      numDownloads,
      category,
    });

    req.session.flash = {
      type: 'success',
      message: 'Imagen subida correctamente.',
    };
    res.redirect('/admin/images');
  }

  private async renderImages(
    res: Response,
    values: Record<string, string> = {},
    errors: Record<string, string> = {},
  ): Promise<void> {
    const [images, categories] = await Promise.all([
      this.adminService.listImages(),
      this.adminService.listCategories(),
    ]);
    res.status(200).render('admin/images', { images, categories, values, errors });
  }
}
