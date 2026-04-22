import * as fs from 'fs';
import * as path from 'path';
import type { ProjectProfile } from '../types';

export function detectProjectProfile(workspaceRoot: string): ProjectProfile {
  const pkgPath = path.join(workspaceRoot, 'package.json');
  const reqPath = path.join(workspaceRoot, 'requirements.txt');
  const pyprojectPath = path.join(workspaceRoot, 'pyproject.toml');

  let primaryLanguage: ProjectProfile['primaryLanguage'] = 'unknown';
  let framework: string | null = null;
  let hasAuth = false;
  let hasPayments = false;
  let hasDatabase = false;
  let hasTesting = false;

  if (fs.existsSync(pkgPath)) {
    primaryLanguage = 'typescript';
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) { framework = 'Next.js'; }
      else if (deps['express']) { framework = 'Express'; }
      else if (deps['fastify']) { framework = 'Fastify'; }
      else if (deps['react']) { framework = 'React'; }

      hasAuth = !!(deps['passport'] || deps['jsonwebtoken'] || deps['bcrypt'] || deps['next-auth']);
      hasPayments = !!(deps['stripe'] || deps['razorpay']);
      hasDatabase = !!(deps['prisma'] || deps['mongoose'] || deps['pg'] || deps['mysql2'] || deps['sequelize']);
      hasTesting = !!(deps['jest'] || deps['vitest'] || deps['mocha'] || deps['cypress']);

      if (fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'))) {
        primaryLanguage = 'typescript';
      } else {
        primaryLanguage = 'javascript';
      }
    } catch {
      // parse error
    }
  } else if (fs.existsSync(reqPath) || fs.existsSync(pyprojectPath)) {
    primaryLanguage = 'python';
    try {
      const content = fs.existsSync(reqPath)
        ? fs.readFileSync(reqPath, 'utf8')
        : fs.readFileSync(pyprojectPath, 'utf8');
      if (content.includes('django')) { framework = 'Django'; }
      else if (content.includes('flask')) { framework = 'Flask'; }
      else if (content.includes('fastapi')) { framework = 'FastAPI'; }

      hasAuth = content.includes('django-allauth') || content.includes('python-jose');
      hasPayments = content.includes('stripe');
      hasDatabase = content.includes('sqlalchemy') || content.includes('django');
      hasTesting = content.includes('pytest') || content.includes('unittest');
    } catch {
      // parse error
    }
  }

  return { primaryLanguage, framework, hasAuth, hasPayments, hasDatabase, hasTesting };
}
