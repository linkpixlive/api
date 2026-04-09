import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { cnpj, cpf } from 'cpf-cnpj-validator';

export const PIX_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PIX_PHONE_REGEX = /^\+?\d{10,15}$/;
export const PIX_RANDOM_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ValidatorConstraint({ async: false })
export class IsPixKeyConstraint implements ValidatorConstraintInterface {
  validate(key: string) {
    if (!key || typeof key !== 'string') return false;

    const digitsOnly = key.replace(/\D/g, '');

    const checks = [
      () => PIX_RANDOM_REGEX.test(key),
      () => PIX_EMAIL_REGEX.test(key),
      () => PIX_PHONE_REGEX.test(key),
      () => digitsOnly.length === 14 && cnpj.isValid(digitsOnly),
      () => digitsOnly.length === 11 && cpf.isValid(digitsOnly),
    ];

    return checks.some((check) => check());
  }

  defaultMessage() {
    return 'Invalid Pix key format. Expected a valid CPF, CNPJ, phone, email, or random key.';
  }
}

export function IsPixKey(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPixKeyConstraint,
    });
  };
}
