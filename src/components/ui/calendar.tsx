"use client"

import * as React from "react"
export type CalendarProps = React.ComponentProps<"div">

function Calendar({
  className,
  ...props
}: CalendarProps) {
  return (
    <div/>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
