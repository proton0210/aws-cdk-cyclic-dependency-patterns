#!/usr/bin/env python3
"""Generate the static article diagrams committed beside this script."""

from __future__ import annotations

import math
from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1600
HEIGHT = 900
OUTPUT = Path(__file__).resolve().parent

NAVY = (31, 41, 55)
INK = (52, 64, 84)
MUTED = (92, 105, 125)
WHITE = (255, 255, 255)
PANEL = (247, 249, 252)
BORDER = (197, 205, 218)
ORANGE = (255, 153, 0)
ORANGE_SOFT = (255, 244, 224)
BLUE = (47, 111, 184)
BLUE_SOFT = (232, 242, 253)
GREEN = (29, 130, 86)
GREEN_SOFT = (229, 247, 238)
RED = (193, 57, 57)
RED_SOFT = (253, 235, 235)
PURPLE = (111, 78, 160)
PURPLE_SOFT = (242, 236, 250)

FONT_PATHS = (
    "/System/Library/Fonts/SFNS.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "DejaVuSans.ttf",
)
MONO_PATHS = (
    "/System/Library/Fonts/SFNSMono.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "C:/Windows/Fonts/consola.ttf",
    "DejaVuSansMono.ttf",
)


def font(size: int, mono: bool = False) -> ImageFont.FreeTypeFont:
    for candidate in MONO_PATHS if mono else FONT_PATHS:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    raise RuntimeError("No supported TrueType font was found")


TITLE = font(48)
SUBTITLE = font(24)
PANEL_TITLE = font(30)
BOX_TITLE = font(25)
BODY = font(20)
SMALL = font(17)
MONO = font(18, mono=True)


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    return image, ImageDraw.Draw(image)


def centered_text(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    y: float,
    text: str,
    text_font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int] = INK,
    spacing: int = 5,
) -> None:
    bounds = draw.multiline_textbbox((0, 0), text, font=text_font, spacing=spacing)
    width = bounds[2] - bounds[0]
    draw.multiline_text(
        (center_x - width / 2, y),
        text,
        font=text_font,
        fill=fill,
        align="center",
        spacing=spacing,
    )


def heading(draw: ImageDraw.ImageDraw, title: str, subtitle: str) -> None:
    centered_text(draw, WIDTH / 2, 34, title, TITLE, NAVY)
    centered_text(draw, WIDTH / 2, 97, subtitle, SUBTITLE, MUTED)
    draw.line((80, 145, WIDTH - 80, 145), fill=ORANGE, width=5)


def panel(
    draw: ImageDraw.ImageDraw,
    bounds: tuple[int, int, int, int],
    title: str,
    accent: tuple[int, int, int],
) -> None:
    draw.rounded_rectangle(bounds, radius=22, fill=PANEL, outline=BORDER, width=2)
    x1, y1, x2, _ = bounds
    draw.rounded_rectangle((x1, y1, x2, y1 + 66), radius=22, fill=accent)
    draw.rectangle((x1, y1 + 42, x2, y1 + 66), fill=accent)
    centered_text(draw, (x1 + x2) / 2, y1 + 16, title, PANEL_TITLE, WHITE)


def fit_lines(text: str, chars: int) -> str:
    return "\n".join(wrap(text, width=chars, break_long_words=False))


def box(
    draw: ImageDraw.ImageDraw,
    bounds: tuple[int, int, int, int],
    title: str,
    detail: str = "",
    *,
    fill: tuple[int, int, int] = WHITE,
    outline: tuple[int, int, int] = BORDER,
    title_color: tuple[int, int, int] = NAVY,
    detail_color: tuple[int, int, int] = MUTED,
    mono_detail: bool = False,
) -> None:
    x1, y1, x2, y2 = bounds
    draw.rounded_rectangle(bounds, radius=18, fill=fill, outline=outline, width=3)
    centered_text(draw, (x1 + x2) / 2, y1 + 20, title, BOX_TITLE, title_color)
    if detail:
        detail_font = MONO if mono_detail else SMALL
        centered_text(
            draw,
            (x1 + x2) / 2,
            y1 + 61,
            detail,
            detail_font,
            detail_color,
            spacing=6,
        )


def arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    color: tuple[int, int, int] = INK,
    width: int = 4,
    label: str | None = None,
    label_offset: tuple[int, int] = (0, -28),
) -> None:
    draw.line((*start, *end), fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    length = 15
    spread = math.pi / 7
    p1 = (
        end[0] - length * math.cos(angle - spread),
        end[1] - length * math.sin(angle - spread),
    )
    p2 = (
        end[0] - length * math.cos(angle + spread),
        end[1] - length * math.sin(angle + spread),
    )
    draw.polygon([end, p1, p2], fill=color)
    if label:
        mx = (start[0] + end[0]) / 2 + label_offset[0]
        my = (start[1] + end[1]) / 2 + label_offset[1]
        bounds = draw.textbbox((0, 0), label, font=SMALL)
        tw = bounds[2] - bounds[0]
        th = bounds[3] - bounds[1]
        draw.rounded_rectangle(
            (mx - tw / 2 - 7, my - 4, mx + tw / 2 + 7, my + th + 6),
            radius=6,
            fill=WHITE,
        )
        draw.text((mx - tw / 2, my), label, font=SMALL, fill=color)


def footer(draw: ImageDraw.ImageDraw, text: str) -> None:
    centered_text(draw, WIDTH / 2, 842, text, SUBTITLE, NAVY)


def save(image: Image.Image, name: str) -> None:
    image.save(OUTPUT / name, format="PNG", optimize=True)


def lifecycle_diagram() -> None:
    image, draw = canvas()
    heading(
        draw,
        "From CDK constructs to a deployable graph",
        "A TypeScript call becomes CloudFormation resources, references, and ordering edges",
    )

    items = [
        (
            "TypeScript app",
            "App → Stack → Construct\nL2/L3 constructs\ncreate L1 children",
            ORANGE_SOFT,
            ORANGE,
        ),
        (
            "CDK synthesis",
            "Resolve tokens\nPrepare and validate\nEmit cloud assembly",
            BLUE_SOFT,
            BLUE,
        ),
        (
            "CFN templates",
            "AWS::S3::Bucket\nAWS::Lambda::Function\nAWS::EC2::\nSecurityGroupIngress",
            PURPLE_SOFT,
            PURPLE,
        ),
        (
            "Dependency DAG",
            "Ref · GetAtt · Sub\nImportValue\nGetStackOutput\nDependsOn",
            RED_SOFT,
            RED,
        ),
        (
            "Deployment",
            "CloudFormation uses\ntopological order for\ncreate · update · delete",
            GREEN_SOFT,
            GREEN,
        ),
    ]

    left = 45
    gap = 24
    width = 282
    y1, y2 = 255, 610
    for index, (name, detail, fill, outline) in enumerate(items):
        x1 = left + index * (width + gap)
        box(
            draw,
            (x1, y1, x1 + width, y2),
            name,
            detail,
            fill=fill,
            outline=outline,
            mono_detail=index in (0, 2, 3),
        )
        if index < len(items) - 1:
            arrow(
                draw,
                (x1 + width + 4, (y1 + y2) / 2),
                (x1 + width + gap - 4, (y1 + y2) / 2),
                color=NAVY,
            )

    draw.rounded_rectangle((250, 680, 1350, 790), radius=18, fill=RED_SOFT)
    centered_text(
        draw,
        WIDTH / 2,
        703,
        "A cycle means CloudFormation cannot choose a valid first node.\nFix the edge; adding another dependency cannot repair A → B → A.",
        SUBTITLE,
        RED,
        spacing=10,
    )
    save(image, "cdk-to-cloudformation-flow.png")


def s3_diagram() -> None:
    image, draw = canvas()
    heading(
        draw,
        "Scenario 1 — S3 notification and Lambda",
        "The L1 problem configures the relationship during bucket creation; the L2 solution defers it",
    )
    panel(draw, (40, 175, 780, 815), "Problem: resource cycle", RED)
    panel(draw, (820, 175, 1560, 815), "Solution: deferred configuration", GREEN)

    # Problem graph. Arrows point from the dependent resource to its prerequisite.
    box(draw, (95, 275, 355, 405), "CfnBucket", "AWS::S3::Bucket", fill=RED_SOFT, outline=RED, mono_detail=True)
    box(draw, (470, 275, 730, 405), "CfnFunction", "AWS::Lambda::Function", mono_detail=True)
    box(draw, (470, 575, 730, 705), "CfnRole", "AWS::IAM::Role", mono_detail=True)
    box(draw, (95, 575, 355, 705), "CfnPermission", "AWS::Lambda::Permission", mono_detail=True)
    arrow(draw, (355, 340), (470, 340), color=RED, label="notification")
    arrow(draw, (600, 405), (600, 575), color=RED, label="execution role", label_offset=(65, 0))
    arrow(draw, (470, 640), (355, 405), color=RED, label="bucket ARN", label_offset=(-34, -5))
    arrow(draw, (225, 575), (225, 405), color=INK, label="DependsOn", label_offset=(-58, 0))
    arrow(draw, (355, 625), (470, 390), color=INK, label="function ARN", label_offset=(30, 2))
    centered_text(draw, 410, 742, "Shortest loop: Bucket → Function → Role → Bucket", BODY, RED)

    # Solution graph.
    box(draw, (855, 275, 1065, 395), "Bucket", "AWS::S3::Bucket", fill=GREEN_SOFT, outline=GREEN, mono_detail=True)
    box(draw, (1110, 275, 1320, 395), "Function", "AWS::Lambda::Function", mono_detail=True)
    box(draw, (1340, 275, 1530, 395), "Role", "AWS::IAM::Role", mono_detail=True)
    box(draw, (855, 535, 1065, 655), "Read policy", "AWS::IAM::Policy", mono_detail=True)
    box(draw, (1110, 535, 1320, 655), "Permission", "AWS::Lambda::Permission", mono_detail=True)
    box(draw, (1340, 515, 1530, 675), "Apply notification", "Custom::\nS3BucketNotifications", fill=GREEN_SOFT, outline=GREEN)

    arrow(draw, (1320, 335), (1340, 335), color=INK)
    arrow(draw, (960, 535), (960, 395), color=INK)
    arrow(draw, (1065, 590), (1340, 370), color=INK)
    arrow(draw, (1215, 535), (1215, 395), color=INK)
    arrow(draw, (1110, 590), (1065, 370), color=INK)
    arrow(draw, (1435, 515), (1065, 370), color=GREEN, width=5)
    arrow(draw, (1340, 575), (1320, 575), color=GREEN, width=5)
    centered_text(
        draw,
        1190,
        710,
        "Bucket creation no longer contains the notification target.\nThe custom resource mutates notifications after prerequisites exist.",
        BODY,
        GREEN,
        spacing=8,
    )
    save(image, "s3-lambda-cycle-and-solution.png")


def security_group_diagram() -> None:
    image, draw = canvas()
    heading(
        draw,
        "Scenario 2 — ECS, Aurora, and security-group rule ownership",
        "The runtime connection is the same; only the stack that owns the relationship resources changes",
    )

    panel(draw, (40, 175, 1560, 445), "Problem: DatabaseStack and ComputeStack depend on each other", RED)
    box(draw, (115, 265, 405, 380), "NetworkStack", "Vpc · public + isolated subnets", fill=BLUE_SOFT, outline=BLUE)
    box(draw, (655, 245, 945, 400), "DatabaseStack", "DatabaseCluster · DatabaseSg", fill=PURPLE_SOFT, outline=PURPLE)
    box(draw, (1195, 245, 1485, 400), "ComputeStack", "FargateService · ServiceSg", fill=ORANGE_SOFT, outline=ORANGE)
    arrow(draw, (655, 325), (405, 325), color=INK, label="VPC")
    arrow(draw, (1195, 350), (945, 350), color=RED, width=6, label="DB endpoint")
    arrow(draw, (945, 280), (1195, 280), color=RED, width=6, label="DB-owned ingress imports ServiceSg")
    centered_text(draw, 800, 408, "Cycle: Compute → Database → Compute", BODY, RED)

    panel(draw, (40, 480, 780, 825), "Solution A: consumer-owned connection", GREEN)
    box(draw, (85, 585, 275, 710), "Network", "NetworkStack", fill=BLUE_SOFT, outline=BLUE)
    box(draw, (315, 565, 525, 730), "Database", "Aurora + DatabaseSg\nno import from Compute", fill=PURPLE_SOFT, outline=PURPLE)
    box(draw, (565, 545, 735, 750), "Compute", "Fargate + ServiceSg\nowns ingress + egress\nallowTo(databaseSg,\nPort.tcp(5432))", fill=GREEN_SOFT, outline=GREEN)
    arrow(draw, (315, 650), (275, 650), color=INK)
    arrow(draw, (565, 635), (525, 635), color=GREEN, width=6)

    panel(draw, (820, 480, 1560, 825), "Solution B: downstream connectivity stack", GREEN)
    box(draw, (850, 565, 1020, 690), "Network", "NetworkStack", fill=BLUE_SOFT, outline=BLUE)
    box(draw, (1050, 545, 1225, 680), "Database", "Aurora + DatabaseSg", fill=PURPLE_SOFT, outline=PURPLE)
    box(draw, (1250, 545, 1425, 680), "Compute", "Fargate + ServiceSg", fill=ORANGE_SOFT, outline=ORANGE)
    box(draw, (1060, 695, 1415, 815), "ConnectivityStack", "CfnSecurityGroupIngress\n+ CfnSecurityGroupEgress", fill=GREEN_SOFT, outline=GREEN, mono_detail=True)
    arrow(draw, (1050, 620), (1020, 620), color=INK)
    arrow(draw, (1250, 620), (1020, 650), color=INK)
    arrow(draw, (1170, 695), (1140, 680), color=GREEN, width=5)
    arrow(draw, (1320, 695), (1335, 680), color=GREEN, width=5)
    save(image, "security-group-cycle-and-solutions.png")


def export_diagram() -> None:
    image, draw = canvas()
    heading(
        draw,
        "Scenario 3 — migrate a strong cross-stack reference safely",
        "Use the same stack names and deploy every intermediate state",
    )

    stages = [
        (
            "1 · STRONG",
            "DataStack\nOutput + Export",
            "ApiStack\nFn::ImportValue",
            "Deletion lock is active",
            RED_SOFT,
            RED,
        ),
        (
            "2 · BOTH",
            "DataStack\nExport + plain\nOutput",
            "ApiStack\nFn::GetStackOutput",
            "Consumers move first",
            ORANGE_SOFT,
            ORANGE,
        ),
        (
            "3 · WEAK",
            "DataStack\nplain Output only",
            "ApiStack\nFn::GetStackOutput",
            "No export lock",
            BLUE_SOFT,
            BLUE,
        ),
        (
            "4 · REMOVE",
            "Output/resource\nmay be removed",
            "Consumer usage\nis gone",
            "Independent lifecycle restored",
            GREEN_SOFT,
            GREEN,
        ),
    ]

    left = 55
    gap = 40
    width = 335
    for index, (name, producer, consumer, note, fill, outline) in enumerate(stages):
        x1 = left + index * (width + gap)
        draw.rounded_rectangle((x1, 235, x1 + width, 730), radius=22, fill=fill, outline=outline, width=4)
        centered_text(draw, x1 + width / 2, 265, name, PANEL_TITLE, outline)
        box(draw, (x1 + 34, 345, x1 + width - 34, 475), "Producer", producer, mono_detail=True)
        box(draw, (x1 + 34, 525, x1 + width - 34, 655), "Consumer", consumer, mono_detail=True)
        arrow(draw, (x1 + width / 2, 525), (x1 + width / 2, 475), color=outline, width=5)
        centered_text(draw, x1 + width / 2, 680, note, SMALL, outline)
        if index < len(stages) - 1:
            arrow(
                draw,
                (x1 + width + 5, 485),
                (x1 + width + gap - 5, 485),
                color=NAVY,
                width=5,
                label=f"deploy {index + 1}",
                label_offset=(0, -38),
            )

    footer(draw, "Skipping BOTH can ask CloudFormation to delete an export before the deployed consumer stops importing it.")
    save(image, "cross-stack-reference-migration.png")


def main() -> None:
    lifecycle_diagram()
    s3_diagram()
    security_group_diagram()
    export_diagram()


if __name__ == "__main__":
    main()
