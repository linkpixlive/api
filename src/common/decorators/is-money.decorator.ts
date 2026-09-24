import { Decimal } from '@prisma/client/runtime/client';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsMoneyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;

    return new Decimal(value).decimalPlaces() <= 2;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} deve ter no máximo 2 casas decimais`;
  }
}

export function IsMoney(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsMoneyConstraint,
    });
  };
}
