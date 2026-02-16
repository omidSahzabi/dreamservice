import { Button } from "@/components/ui/button"
import { ArrowUpRightIcon } from "lucide-react"


export default function Home() {
  return (
    <div className="text-red-800">
      <p>hello world</p>
      <Button size="icon-lg" aria-label="Submit" variant="secondary">
          <ArrowUpRightIcon />
        </Button>
    </div>
  );
}
