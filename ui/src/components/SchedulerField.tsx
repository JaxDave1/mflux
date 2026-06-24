import {
  normalizeSchedulerForModel,
  schedulerOptionsForModel,
  type SchedulerId
} from "../lib/schedulerOptions";
import { SelectField } from "./SelectField";

export function SchedulerField({
  model,
  value,
  onChange,
  className
}: {
  model: string;
  value: SchedulerId;
  onChange: (value: SchedulerId) => void;
  className?: string;
}) {
  return (
    <SelectField
      label="SCHEDULER"
      value={value}
      onChange={(next) => onChange(normalizeSchedulerForModel(model, next))}
      options={schedulerOptionsForModel(model)}
      className={className}
    />
  );
}