import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, Check } from 'lucide-react';
import { getTotalCapital, setTotalCapital, validateTotalCapital } from '../utils/totalCapitalStorage';
import { toast } from 'sonner';

interface TotalCapitalInputProps {
  onSave?: (value: number) => void;
}

export function TotalCapitalInput({ onSave }: TotalCapitalInputProps) {
  const [value, setValue] = useState<string>('');
  const [initialValue, setInitialValue] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const stored = getTotalCapital();
    if (stored !== null) {
      setValue(stored.toString());
      setInitialValue(stored);
    }
  }, []);

  const handleSave = () => {
    const numValue = parseFloat(value);

    if (!validateTotalCapital(numValue)) {
      toast.error('Please enter a valid positive number');
      return;
    }

    // setTotalCapital now returns void — just call it
    setTotalCapital(numValue);
    setInitialValue(numValue);
    setShowSuccess(true);
    toast.success('Total capital saved successfully');

    if (onSave) {
      onSave(numValue);
    }

    setTimeout(() => setShowSuccess(false), 2000);
  };

  const numValue = parseFloat(value);
  const isValid = validateTotalCapital(numValue);
  const isUnchanged = initialValue !== null && numValue === initialValue;
  const isDisabled = !isValid || isUnchanged;

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="w-5 h-5 text-primary" />
          Total Trading Capital
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="total-capital">Enter your total trading capital</Label>
          <Input
            id="total-capital"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter your trading capital"
            className="text-lg"
          />
          <p className="text-xs text-muted-foreground">
            This will be used to calculate risk percentages across your portfolio
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isDisabled}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {showSuccess ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            'Save Total Capital'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default TotalCapitalInput;
