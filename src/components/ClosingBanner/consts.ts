export const closingText = (seconds: number) =>
  seconds > 0
    ? `This floor closes for editing in ${seconds} s. Finish what you are doing.`
    : "This floor is closing for editing…";
