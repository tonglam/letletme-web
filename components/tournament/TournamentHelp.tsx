"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, HelpCircle, BookOpen, Check, AlertCircle, FileQuestion } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface TournamentHelpProps {
  className?: string;
}

// Mock data for rules
const tournamentRules = [
  {
    title: "Participant Selection",
    icon: <Users className="h-5 w-5 text-blue-500" />,
    content: [
      "You can select participants from an official Fantasy Premier League, create a custom selection, or manually enter participants.",
      "When using an official FPL league, enter the league URL and click 'Fetch' to load all teams.",
      "Make sure to select at least 2 participants for your tournament."
    ]
  },
  {
    title: "Tournament Structure",
    icon: <Trophy className="h-5 w-5 text-yellow-500" />,
    content: [
      "Choose between Standard, Swiss, or Knockout tournament formats.",
      "Set the start and end gameweeks for your tournament.",
      "Ensure there are enough gameweeks to complete all tournament rounds."
    ]
  },
  {
    title: "Group Stage Setup",
    icon: <Users className="h-5 w-5 text-green-500" />,
    content: [
      "You can choose between no group stage, points-based groups, or head-to-head format.",
      "Define the number of teams per group and how many teams qualify from each group.",
      "The system will automatically calculate how many groups will be created based on participant count."
    ]
  },
  {
    title: "Knockout Stage Setup",
    icon: <Zap className="h-5 w-5 text-purple-500" />,
    content: [
      "Choose between no knockout stage, single elimination, or home & away format.",
      "Set the number of rounds and matches per round.",
      "For knockout stages, the number of participants should be a power of 2 (4, 8, 16, 32, etc.)."
    ]
  },
  {
    title: "Scheduling",
    icon: <Calendar className="h-5 w-5 text-red-500" />,
    content: [
      "Set the start and end gameweeks for both group and knockout stages.",
      "Ensure there's no overlap between group and knockout phases if you're using both.",
      "The system will validate that you have enough gameweeks to complete the tournament."
    ]
  }
];

// Mock data for FAQs
const tournamentFAQs = [
  {
    question: "How many participants can I add to my tournament?",
    answer: "You can add between 2 and 64 participants to your tournament. The ideal number depends on your format - for knockout stages, we recommend a power of 2 (4, 8, 16, 32, etc.)."
  },
  {
    question: "Can I change the tournament settings after creation?",
    answer: "Some settings can be modified after tournament creation, but structural settings (like number of groups or knockout rounds) cannot be changed once participants have been assigned."
  },
  {
    question: "How are tiebreakers handled in group stages?",
    answer: "For points-based groups, tiebreakers are resolved in this order: 1) Head-to-head results, 2) Total FPL points, 3) Overall FPL rank. For head-to-head groups, we use: 1) Points, 2) FPL points difference, 3) Total FPL points."
  },
  {
    question: "What happens if a participant is inactive or doesn't make transfers?",
    answer: "The tournament uses the participant's FPL team as is, including any automatic substitutions made by the FPL system. Inactive managers will simply use their last saved team."
  },
  {
    question: "Can I run multiple tournaments simultaneously?",
    answer: "Yes, you can create and manage multiple tournaments with different participants and settings simultaneously."
  },
  {
    question: "How are knockout matchups determined?",
    answer: "For tournaments with a group stage, knockout matchups are typically determined by group position (group winners face runners-up from other groups). For direct knockout tournaments, matchups are randomly seeded."
  },
  {
    question: "What happens if there's a tie in a knockout match?",
    answer: "In case of a tie in a knockout match, the winner is determined by: 1) Higher FPL gameweek points, 2) Higher overall FPL rank, 3) Random selection if all else is equal."
  },
  {
    question: "Can I remove a participant after the tournament has started?",
    answer: "Once a tournament has started, you cannot remove participants, but you can mark them as inactive, which will result in automatic losses for their scheduled matches."
  }
];

// Add missing icon imports
import { Users, Trophy, Zap, Calendar } from "lucide-react";

export function TournamentHelp({ className }: TournamentHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={className}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 mb-4"
      >
        {isOpen ? (
          <>
            <ChevronUp className="h-4 w-4" />
            Hide Help & FAQ
          </>
        ) : (
          <>
            <HelpCircle className="h-4 w-4" />
            Show Help & FAQ
          </>
        )}
      </Button>

      {isOpen && (
        <Card className="p-6 mb-8 animate-in fade-in-50 duration-300">
          <Tabs defaultValue="rules">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="rules" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Tournament Rules
              </TabsTrigger>
              <TabsTrigger value="faq" className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                FAQ
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="rules" className="space-y-6">
              <div className="text-muted-foreground mb-4">
                <p>Here's everything you need to know about setting up and running a tournament. Follow these guidelines to create an engaging and fair competition for all participants.</p>
              </div>
              
              {tournamentRules.map((rule, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {rule.icon}
                    <h3 className="text-lg font-semibold">{rule.title}</h3>
                  </div>
                  <ul className="list-disc pl-10 space-y-1 text-muted-foreground">
                    {rule.content.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                  {index < tournamentRules.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
              
              <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg mt-6 flex gap-3">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-700 dark:text-blue-300">Pro Tip</h4>
                  <p className="text-blue-600 dark:text-blue-400 text-sm">
                    For the best experience, we recommend starting with a standard tournament format with a group stage followed by a knockout phase. This gives participants more matches and increases engagement.
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="faq" className="space-y-6">
              <div className="text-muted-foreground mb-4">
                <p>Common questions about tournament creation and management. If you don't find your answer here, feel free to contact support.</p>
              </div>
              
              <div className="space-y-6">
                {tournamentFAQs.map((faq, index) => (
                  <div key={index} className="space-y-2">
                    <h3 className="text-lg font-semibold flex items-start gap-2">
                      <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      {faq.question}
                    </h3>
                    <p className="text-muted-foreground pl-8">{faq.answer}</p>
                    {index < tournamentFAQs.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
              
              <div className="bg-green-50 dark:bg-green-950/50 p-4 rounded-lg mt-6 flex gap-3">
                <div className="flex-shrink-0">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h4 className="font-medium text-green-700 dark:text-green-300">Still have questions?</h4>
                  <p className="text-green-600 dark:text-green-400 text-sm">
                    Our support team is available to help with any questions about tournament setup or management. Contact us at support@letletme.com.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
}