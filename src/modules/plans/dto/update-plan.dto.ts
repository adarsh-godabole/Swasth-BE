import { PartialType } from '@nestjs/swagger';
import { CreatePlanDto } from './create-plan.dto';

/// Editing a plan never touches subscriptions already sold - price, name and
/// duration are copied onto each subscription at purchase.
export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
